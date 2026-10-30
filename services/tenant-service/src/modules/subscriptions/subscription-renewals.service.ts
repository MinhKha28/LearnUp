import type { CurrentUser } from '@learnup/ts-common';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
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
import { RenewSubscriptionDto } from './dto/renew-subscription.dto';
import { IRenewalQuote } from './interfaces/renewal-quote.interface';
import { IRenewalResult } from './interfaces/renewal-result.interface';
import { exceededLimits, renewalPeriod } from './renewal.policy';
import { SubscriptionsRepository } from './subscriptions.repository';

const RENEWAL_TIMEOUT_MS = 30_000;

@Injectable()
export class SubscriptionRenewalsService {
  private readonly logger = new Logger(SubscriptionRenewalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: SubscriptionsRepository,
    private readonly courseService: CourseServiceClient,
    private readonly paymentGateway: MockPaymentGateway,
  ) {}

  // ===========================================================================
  // UC10.1 - Gia hạn Subscription: màn hình trước khi thanh toán (BR-4, BR-14)
  // ===========================================================================
  async getQuote(user: CurrentUser): Promise<IRenewalQuote> {
    const organizationId = this.organizationIdOf(user);
    const { current, plan } = await this.loadRenewable(organizationId);
    const period = renewalPeriod(current, plan.durationDays, new Date())!;

    const [scheduled, learners, instructors, courseUsage] = await Promise.all([
      this.repository.findScheduled(organizationId),
      this.repository.countSeats(organizationId, UserRoleValue.Learner),
      this.repository.countSeats(organizationId, UserRoleValue.Instructor),
      this.loadCourseUsage(user),
    ]);

    return {
      planName: plan.name,
      planOffered: plan.isOffered,
      currentStatus: current.status,
      price: Number(plan.price),
      durationDays: plan.durationDays,
      maxLearners: plan.maxLearners,
      maxInstructors: plan.maxInstructors,
      maxCourseChains: plan.maxCourseChains,
      maxStorageBytes: Number(plan.maxStorageBytes),
      startsAt: period.startsAt,
      expiresAt: period.expiresAt,
      scheduledRenewal: scheduled
        ? { startsAt: scheduled.startsAt, expiresAt: scheduled.expiresAt }
        : null,
      usageAvailable: courseUsage !== null,
      exceededLimits: exceededLimits(
        {
          learners,
          instructors,
          courses: courseUsage?.courseChains ?? null,
          storageBytes: courseUsage?.storageBytes ?? null,
        },
        {
          learners: plan.maxLearners,
          instructors: plan.maxInstructors,
          courses: plan.maxCourseChains,
          storageBytes: Number(plan.maxStorageBytes),
        },
      ),
    };
  }

  // ===========================================================================
  // UC10.1 - Gia hạn Subscription: thanh toán (BR-14 đến BR-17, include UC02.1)
  // ===========================================================================
  /**
   * Giữ khóa theo tổ chức suốt lượt gia hạn; thanh toán nằm ngoài transaction ghi dữ liệu, Payment Failed vẫn được lưu.
   * Lượt thứ hai trong lúc đang xử lý bị từ chối trước khi trừ tiền.
   */
  renew(user: CurrentUser, dto: RenewSubscriptionDto): Promise<IRenewalResult> {
    const organizationId = this.organizationIdOf(user);
    return this.prisma.$transaction(
      async (lockTx) => {
        if (!(await this.repository.tryLockRenewal(organizationId, lockTx))) {
          throw new ConflictException({
            code: 'RENEWAL_IN_PROGRESS',
            message: 'Đang có một lượt gia hạn được xử lý. Vui lòng thử lại.',
          });
        }
        return this.renewLocked(organizationId, dto);
      },
      { timeout: RENEWAL_TIMEOUT_MS },
    );
  }

  private async renewLocked(
    organizationId: string,
    dto: RenewSubscriptionDto,
  ): Promise<IRenewalResult> {
    const { current, plan } = await this.loadRenewable(organizationId);
    if (
      current.status === SubscriptionStatus.Active &&
      (await this.repository.findScheduled(organizationId))
    ) {
      throw new ConflictException({
        code: 'RENEWAL_ALREADY_SCHEDULED',
        message: 'Tổ chức đã có một kỳ gia hạn trước chưa bắt đầu.',
      });
    }

    const payment = await this.repository.createPayment({
      organizationId,
      planId: plan.id,
      kind: PaymentKind.Renewal,
      amount: plan.price,
      status: PaymentStatus.Pending,
    });
    const charge = await this.paymentGateway.charge({
      paymentId: payment.id,
      amount: payment.amount,
      simulateFailure: dto.simulateFailure,
    });
    if (!charge.success) {
      await this.repository.markPaymentFailed(payment.id, charge.failureReason);
      return {
        paymentId: payment.id,
        paymentStatus: PaymentStatus.Failed,
        failureReason: charge.failureReason,
      };
    }

    const paidAt = new Date();
    const subscription = await this.prisma.$transaction(async (tx) => {
      const fresh = await this.repository.findCurrentWithPlan(
        organizationId,
        tx,
      );
      const period = fresh && renewalPeriod(fresh, plan.durationDays, paidAt);
      if (!fresh || !period) throw this.subscriptionMissing();
      if (period.endsCurrent) {
        await this.repository.endSubscription(fresh.id, paidAt, tx);
      }
      const created = await this.repository.createSubscription(
        {
          organizationId,
          planId: plan.id,
          source: PaymentKind.Renewal,
          status: period.status,
          price: plan.price,
          durationDays: plan.durationDays,
          maxLearners: plan.maxLearners,
          maxInstructors: plan.maxInstructors,
          maxCourseChains: plan.maxCourseChains,
          maxStorageBytes: plan.maxStorageBytes,
          startsAt: period.startsAt,
          expiresAt: period.expiresAt,
        },
        tx,
      );
      await this.repository.markPaymentSucceeded(
        payment.id,
        {
          paidAt,
          subscriptionId: created.id,
          providerReference: charge.providerReference,
        },
        tx,
      );
      return created;
    });

    return {
      paymentId: payment.id,
      paymentStatus: PaymentStatus.Succeeded,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        startsAt: subscription.startsAt,
        expiresAt: subscription.expiresAt,
      },
    };
  }

  /** Tổ chức bị Admin tạm khóa hoặc không còn Subscription hiện hành thì không gia hạn được. */
  private async loadRenewable(organizationId: string) {
    const organization =
      await this.repository.findRenewalContext(organizationId);
    if (organization?.status !== OrganizationStatus.Active) {
      throw new ForbiddenException({
        code: 'ORGANIZATION_NOT_ACTIVE',
        message: 'Tổ chức đang không hoạt động nên không gia hạn được.',
      });
    }
    const current = await this.repository.findCurrentWithPlan(organizationId);
    if (!current) throw this.subscriptionMissing();
    return { current, plan: current.plan };
  }

  private async loadCourseUsage(user: CurrentUser) {
    try {
      return await this.courseService.getOrganizationUsage(user);
    } catch (error) {
      this.logger.warn(
        `Không lấy được mức dùng Course/dung lượng: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private subscriptionMissing(): ForbiddenException {
    return new ForbiddenException({
      code: 'SUBSCRIPTION_NOT_FOUND',
      message: 'Tổ chức không có Subscription để gia hạn.',
    });
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
