import type { CurrentUser } from '@learnup/ts-common';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { SubscriptionPlan } from '../../../generated/prisma/client';
import {
  OrganizationStatus,
  PaymentKind,
  PaymentStatus,
  SubscriptionStatus,
  UserRoleValue,
} from '../../common/constants/tenant.constants';
import { CourseServiceClient } from '../../infrastructure/clients/course/course-service.client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { MockPaymentGateway } from '../payments/mock-payment.gateway';
import { UpgradeSubscriptionDto } from './dto/upgrade-subscription.dto';
import { IUpgradeOptions } from './interfaces/upgrade-options.interface';
import { IUpgradeResult } from './interfaces/upgrade-result.interface';
import { SubscriptionsRepository } from './subscriptions.repository';
import {
  blockingLimits,
  ILimitValues,
  remainingDays,
  upgradeAmount,
} from './upgrade.policy';

const UPGRADE_TIMEOUT_MS = 30_000;

const limitsOf = (source: {
  maxLearners: number;
  maxInstructors: number;
  maxCourseChains: number;
  maxStorageBytes: bigint;
}): ILimitValues => ({
  learners: source.maxLearners,
  instructors: source.maxInstructors,
  courses: source.maxCourseChains,
  storageBytes: Number(source.maxStorageBytes),
});

@Injectable()
export class SubscriptionUpgradesService {
  private readonly logger = new Logger(SubscriptionUpgradesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: SubscriptionsRepository,
    private readonly courseService: CourseServiceClient,
    private readonly paymentGateway: MockPaymentGateway,
  ) {}

  // ===========================================================================
  // UC10.2 - Nâng cấp Subscription: chọn gói (BR-3, BR-18 đến BR-21)
  // ===========================================================================
  async getOptions(user: CurrentUser): Promise<IUpgradeOptions> {
    const organizationId = this.organizationIdOf(user);
    const current = await this.loadCurrent(organizationId);
    const [plans, scheduled, usage] = await Promise.all([
      this.repository.findOfferedPlans(),
      this.repository.findScheduled(organizationId),
      this.loadUsage(user, organizationId),
    ]);
    const days = remainingDays(current.expiresAt, new Date());
    return {
      currentPlanName: current.plan.name,
      currentPrice: Number(current.price),
      currentDurationDays: current.durationDays,
      currentStatus: current.status,
      expiresAt: current.expiresAt,
      remainingDays: days,
      blockedReason:
        current.status !== SubscriptionStatus.Active
          ? 'SUBSCRIPTION_NOT_ACTIVE'
          : scheduled
            ? 'RENEWAL_ALREADY_SCHEDULED'
            : null,
      usageAvailable: usage.courses !== null && usage.storageBytes !== null,
      options: plans
        .filter((plan) => plan.id !== current.planId)
        .map((plan) => ({
          id: plan.id,
          name: plan.name,
          price: Number(plan.price),
          durationDays: plan.durationDays,
          maxLearners: plan.maxLearners,
          maxInstructors: plan.maxInstructors,
          maxCourseChains: plan.maxCourseChains,
          maxStorageBytes: Number(plan.maxStorageBytes),
          amount: Number(upgradeAmount(plan, current, days)),
          blockedBy: blockingLimits(limitsOf(plan), limitsOf(current), usage),
        })),
    };
  }

  // ===========================================================================
  // UC10.2 - Nâng cấp Subscription: áp dụng (include UC02.1 khi số tiền dương)
  // ===========================================================================
  /** Dùng chung khóa với gia hạn: mỗi tổ chức một thao tác đổi Subscription tại một thời điểm, lượt sau bị từ chối trước khi trừ tiền. */
  upgrade(
    user: CurrentUser,
    dto: UpgradeSubscriptionDto,
  ): Promise<IUpgradeResult> {
    const organizationId = this.organizationIdOf(user);
    return this.prisma.$transaction(
      async (lockTx) => {
        if (!(await this.repository.tryLockRenewal(organizationId, lockTx))) {
          throw new ConflictException({
            code: 'RENEWAL_IN_PROGRESS',
            message:
              'Đang có một thao tác đổi gói được xử lý. Vui lòng thử lại.',
          });
        }
        return this.upgradeLocked(user, organizationId, dto);
      },
      { timeout: UPGRADE_TIMEOUT_MS },
    );
  }

  private async upgradeLocked(
    user: CurrentUser,
    organizationId: string,
    dto: UpgradeSubscriptionDto,
  ): Promise<IUpgradeResult> {
    const current = await this.loadCurrent(organizationId);
    if (current.status !== SubscriptionStatus.Active) {
      throw new ForbiddenException({
        code: 'SUBSCRIPTION_NOT_ACTIVE',
        message:
          'Chỉ nâng cấp được khi Subscription đang hoạt động. Vui lòng gia hạn.',
      });
    }
    if (await this.repository.findScheduled(organizationId)) {
      throw new ConflictException({
        code: 'RENEWAL_ALREADY_SCHEDULED',
        message:
          'Không nâng cấp được khi đang có kỳ gia hạn trước chưa bắt đầu.',
      });
    }
    const plan = await this.loadTargetPlan(dto.planId, current.planId);

    const usage = await this.loadUsage(user, organizationId);
    if (usage.courses === null || usage.storageBytes === null) {
      throw new ServiceUnavailableException({
        code: 'USAGE_UNAVAILABLE',
        message:
          'Chưa kiểm tra được mức sử dụng Course và dung lượng. Vui lòng thử lại sau.',
      });
    }
    if (blockingLimits(limitsOf(plan), limitsOf(current), usage).length > 0) {
      throw new ConflictException({
        code: 'UPGRADE_LIMITS_TOO_LOW',
        message:
          'Giới hạn của gói đích thấp hơn mức đang sử dụng hoặc giới hạn đang giữ.',
      });
    }

    const amount = upgradeAmount(
      plan,
      current,
      remainingDays(current.expiresAt, new Date()),
    );
    let paymentId: string | null = null;
    let providerReference: string | null = null;
    if (amount > 0n) {
      const payment = await this.repository.createPayment({
        organizationId,
        planId: plan.id,
        kind: PaymentKind.Upgrade,
        amount,
        status: PaymentStatus.Pending,
      });
      paymentId = payment.id;
      const charge = await this.paymentGateway.charge({
        paymentId: payment.id,
        amount,
        simulateFailure: dto.simulateFailure,
      });
      if (!charge.success) {
        await this.repository.markPaymentFailed(
          payment.id,
          charge.failureReason,
        );
        return {
          paymentId: payment.id,
          paymentStatus: PaymentStatus.Failed,
          amount: Number(amount),
          failureReason: charge.failureReason,
        };
      }
      providerReference = charge.providerReference;
    }

    const paidAt = new Date();
    const subscription = await this.prisma.$transaction(async (tx) => {
      await this.repository.endSubscription(current.id, paidAt, tx);
      const created = await this.repository.createSubscription(
        {
          organizationId,
          planId: plan.id,
          source: PaymentKind.Upgrade,
          status: SubscriptionStatus.Active,
          price: plan.price,
          durationDays: plan.durationDays,
          maxLearners: plan.maxLearners,
          maxInstructors: plan.maxInstructors,
          maxCourseChains: plan.maxCourseChains,
          maxStorageBytes: plan.maxStorageBytes,
          startsAt: paidAt,
          expiresAt: current.expiresAt,
        },
        tx,
      );
      if (paymentId) {
        await this.repository.markPaymentSucceeded(
          paymentId,
          { paidAt, subscriptionId: created.id, providerReference },
          tx,
        );
      }
      return created;
    });

    return {
      paymentId,
      paymentStatus: paymentId ? PaymentStatus.Succeeded : 'NotRequired',
      amount: Number(amount),
      subscription: {
        id: subscription.id,
        planName: plan.name,
        status: subscription.status,
        startsAt: subscription.startsAt,
        expiresAt: subscription.expiresAt,
      },
    };
  }

  /** BR-3: gói đã ngừng cung cấp không được chọn làm gói đích. */
  private async loadTargetPlan(
    planId: string,
    currentPlanId: string,
  ): Promise<SubscriptionPlan> {
    const plan = await this.repository.findPlanById(planId);
    if (!plan || !plan.isOffered || plan.id === currentPlanId) {
      throw new BadRequestException({
        code: 'PLAN_NOT_AVAILABLE',
        message:
          'Gói đích không tồn tại, đã ngừng cung cấp hoặc là gói đang dùng.',
      });
    }
    return plan;
  }

  private async loadCurrent(organizationId: string) {
    const organization =
      await this.repository.findRenewalContext(organizationId);
    if (organization?.status !== OrganizationStatus.Active) {
      throw new ForbiddenException({
        code: 'ORGANIZATION_NOT_ACTIVE',
        message: 'Tổ chức đang không hoạt động nên không nâng cấp được.',
      });
    }
    const current = await this.repository.findCurrentWithPlan(organizationId);
    if (!current) {
      throw new ForbiddenException({
        code: 'SUBSCRIPTION_NOT_FOUND',
        message: 'Tổ chức không có Subscription để nâng cấp.',
      });
    }
    return current;
  }

  private async loadUsage(user: CurrentUser, organizationId: string) {
    const [learners, instructors, courseUsage] = await Promise.all([
      this.repository.countSeats(organizationId, UserRoleValue.Learner),
      this.repository.countSeats(organizationId, UserRoleValue.Instructor),
      this.courseService.getOrganizationUsage(user).catch((error: Error) => {
        this.logger.warn(
          `Không lấy được mức dùng Course/dung lượng: ${error.message}`,
        );
        return null;
      }),
    ]);
    return {
      learners,
      instructors,
      courses: courseUsage?.courseChains ?? null,
      storageBytes: courseUsage?.storageBytes ?? null,
    };
  }

  private organizationIdOf(user: CurrentUser): string {
    if (!user.organizationId) {
      throw new ForbiddenException({
        code: 'ORGANIZATION_REQUIRED',
        message: 'Tài khoản không thuộc tổ chức nào.',
      });
    }
    return user.organizationId;
  }
}
