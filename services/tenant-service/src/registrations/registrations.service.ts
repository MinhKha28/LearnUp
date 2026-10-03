import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v7 as uuidv7 } from 'uuid';
import { Prisma, Registration } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { OutboxService } from '../outbox/outbox.service';
import { IdentityClient } from '../integrations/identity.client';
import {
  DAY_MS,
  HOUR_MS,
  OrganizationStatus,
  PaymentKind,
  PaymentStatus,
  RegistrationStatus,
  SubscriptionStatus,
  TokenPurpose,
  UserRoleValue,
  UserStatus,
} from '../common/constants/tenant.constants';

import { generateSecretToken, hashToken } from '../common/utils/token.util';
import { CreateRegistrationDto } from './dto/create-registrations.dto';
import { IRegistrationSummary } from './interfaces/registration-summary.interface';
import { AccountTokensService } from '../account-tokens/account-tokens.service';
import { MockPaymentGateway } from '../payments/mock-payment.gateway';
import { PayRegistrationDto } from './dto/pay-registration.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { IVerifyEmailResult } from './interfaces/verify-email-result.interface';
import { IPaymentResult } from './interfaces/payment-result.interface';

@Injectable()
export class RegistrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly settingsService: PlatformSettingsService,
    private readonly outbox: OutboxService,
    private readonly identity: IdentityClient,
    private readonly accountTokens: AccountTokensService,
    private readonly paymentGateway: MockPaymentGateway,
  ) {}

  async create(dto: CreateRegistrationDto) {
    const settings = await this.settingsService.get();
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: dto.planId },
    });
    if (!plan || !plan.isOffered) {
      throw new BadRequestException({
        code: 'PLAN_NOT_AVAILABLE',
        message: 'Gói dịch vụ không tồn tại hoặc đã ngừng cung cấp.',
      });
    }
    const existingUser = await this.prisma.user.findFirst({
      where: { email: dto.organizer.email, deletedAt: null },
    });
    if (existingUser) {
      const pending = await this.prisma.registration.findFirst({
        where: {
          organizerUserId: existingUser.id,
          status: RegistrationStatus.PendingPayment,
        },
      });

      if (pending && pending.expiresAt.getTime() > Date.now()) {
        await this.resendReopenLink(pending, settings.maxLinkResendsPer24h);
        return {
          resent: true,
          message:
            'Email này đang có một đăng ký chờ thanh toán. Vui lòng kiểm tra hộp thư để tiếp tục.',
        };
      }

      if (pending) {
        await this.expireRegistration(pending);
      } else {
        throw new ConflictException({
          code: 'EMAIL_ALREADY_USED',
          message: 'Email đã được sử dụng cho một tài khoản khác.',
        });
      }
    }
    const organizerId = uuidv7();
    await this.identity.setPassword(organizerId, dto.organizer.password);

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + settings.pendingRegistrationTtlHours * HOUR_MS,
    );
    const { rawToken, tokenHash } = generateSecretToken();

    try {
      const registration = await this.prisma.$transaction(async (tx) => {
        const organization = await tx.organization.create({
          data: {
            name: dto.organization.name,
            taxCode: dto.organization.taxCode,
            address: dto.organization.address,
            contactPhone: dto.organization.contactPhone,
            contactEmail: dto.organization.contactEmail ?? null,
            status: OrganizationStatus.PendingPayment,
          },
        });

        // BR-5: tài khoản Organizer ở trạng thái chưa xác thực email.
        await tx.user.create({
          data: {
            id: organizerId,
            organizationId: organization.id,
            email: dto.organizer.email,
            fullName: dto.organizer.fullName,
            role: UserRoleValue.Organizer,
            status: UserStatus.Pending,
          },
        });

        // BR-275: chụp giá, thời hạn và 4 giới hạn của gói tại thời điểm tạo.
        const created = await tx.registration.create({
          data: {
            organizationId: organization.id,
            organizerUserId: organizerId,
            planId: plan.id,
            price: plan.price,
            durationDays: plan.durationDays,
            maxLearners: plan.maxLearners,
            maxInstructors: plan.maxInstructors,
            maxCourseChains: plan.maxCourseChains,
            maxStorageBytes: plan.maxStorageBytes,
            status: RegistrationStatus.PendingPayment,
            expiresAt,
            reopenTokenHash: tokenHash,
          },
        });

        // BR-6: thư thứ nhất chứa liên kết mở lại đăng ký để thanh toán.
        await this.outbox.enqueueEmail(tx, {
          aggregateType: 'Organization',
          aggregateId: organization.id,
          organizationId: organization.id,
          email: {
            to: dto.organizer.email,
            subject: 'LearnUP - Hoàn tất thanh toán đăng ký',
            templateCode: 'REGISTRATION_REOPEN_LINK',
            body:
              `Xin chào ${dto.organizer.fullName},\n` +
              `Đăng ký Organization "${organization.name}" đang chờ thanh toán.\n` +
              `Mở liên kết sau để thanh toán: ${this.reopenLink(rawToken)}\n` +
              `Liên kết có hiệu lực tới ${expiresAt.toISOString()}.`,
          },
        });

        return created;
      });

      // ---- GĐ5. Trả chuỗi gốc cho chính người vừa đăng ký để chuyển thẳng sang bước thanh toán.
      return {
        resent: false,
        registrationId: registration.id,
        paymentToken: rawToken,
        expiresAt: registration.expiresAt,
      };
    } catch (error) {
      // P2002: vi phạm ràng buộc duy nhất (2 request cùng email gửi đồng thời).
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'EMAIL_ALREADY_USED',
          message: 'Email đã được sử dụng cho một tài khoản khác.',
        });
      }
      throw error;
    }
  }

  // ===========================================================================
  // UC02.1 - Xem tóm tắt đăng ký theo liên kết (màn thanh toán)
  // ===========================================================================
  async getByToken(rawToken: string): Promise<IRegistrationSummary> {
    const registration = await this.findByTokenOrThrow(rawToken);
    await this.assertNotExpired(registration);

    return {
      registrationId: registration.id,
      status: registration.status,
      expiresAt: registration.expiresAt,
      organizationName: registration.organization.name,
      organizerEmail: registration.organizer.email,
      plan: {
        name: registration.plan.name,
        price: Number(registration.price),
        durationDays: registration.durationDays,
        maxLearners: registration.maxLearners,
        maxInstructors: registration.maxInstructors,
        maxCourseChains: registration.maxCourseChains,
        maxStorageBytes: Number(registration.maxStorageBytes),
      },
    };
  }

  // ===========================================================================
  // UC02.1 - Thực hiện thanh toán
  // ===========================================================================
  async pay(dto: PayRegistrationDto): Promise<IPaymentResult> {
    const registration = await this.findByTokenOrThrow(dto.token);
    await this.assertNotExpired(registration);
    if (registration.status !== RegistrationStatus.PendingPayment) {
      throw new ConflictException({
        code: 'REGISTRATION_ALREADY_PAID',
        message:
          'Đăng ký đã được thanh toán. Vui lòng kiểm tra email để xác thực tài khoản.',
      });
    }

    const payment = await this.prisma.payment.create({
      data: {
        organizationId: registration.organizationId,
        planId: registration.planId,
        kind: PaymentKind.Registration,
        registrationId: registration.id,
        amount: registration.price,
        status: PaymentStatus.Pending,
      },
    });

    const result = await this.paymentGateway.charge({
      paymentId: payment.id,
      amount: payment.amount,
      simulateFailure: dto.simulateFailure,
    });

    if (!result.success) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.Failed,
          failureReason: result.failureReason,
        },
      });
      return {
        paymentId: payment.id,
        paymentStatus: PaymentStatus.Failed,
        failureReason: result.failureReason,
      };
    }

    const settings = await this.settingsService.get();
    const paidAt = new Date();

    const subscription = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.registration.updateMany({
        where: {
          id: registration.id,
          status: RegistrationStatus.PendingPayment,
        },
        data: { status: RegistrationStatus.Paid, paidAt },
      });
      if (updated.count === 0) {
        throw new ConflictException({
          code: 'REGISTRATION_ALREADY_PAID',
          message: 'Đăng ký đã được thanh toán.',
        });
      }

      // ② BR-9: kỳ Subscription bắt đầu lúc thanh toán thành công; nhận giá trị đã chốt (BR-275).
      const created = await tx.subscription.create({
        data: {
          organizationId: registration.organizationId,
          planId: registration.planId,
          source: PaymentKind.Registration,
          status: SubscriptionStatus.Active,
          price: registration.price,
          durationDays: registration.durationDays,
          maxLearners: registration.maxLearners,
          maxInstructors: registration.maxInstructors,
          maxCourseChains: registration.maxCourseChains,
          maxStorageBytes: registration.maxStorageBytes,
          startsAt: paidAt,
          expiresAt: new Date(
            paidAt.getTime() + registration.durationDays * DAY_MS,
          ),
        },
      });

      // ③ Giao dịch thành công, gắn với kỳ Subscription vừa tạo.
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.Succeeded,
          paidAt,
          subscriptionId: created.id,
          providerReference: result.providerReference,
        },
      });

      // ④ Tổ chức được kích hoạt.
      await tx.organization.update({
        where: { id: registration.organizationId },
        data: { status: OrganizationStatus.Active },
      });

      // ⑤ BR-6, BR-20: phát liên kết xác thực email Organizer...
      const verifyToken = await this.accountTokens.issue(tx, {
        organizationId: registration.organizationId,
        userId: registration.organizerUserId,
        purpose: TokenPurpose.EmailVerification,
        ttlDays: settings.invitationLinkTtlDays,
      });

      // ⑥ ...và xếp thư thứ hai vào outbox.
      await this.outbox.enqueueEmail(tx, {
        aggregateType: 'User',
        aggregateId: registration.organizerUserId,
        organizationId: registration.organizationId,
        email: {
          to: registration.organizer.email,
          subject: 'LearnUP - Xác thực email Organizer',
          templateCode: 'ORGANIZER_EMAIL_VERIFICATION',
          body:
            `Xin chào ${registration.organizer.fullName},\n` +
            `Thanh toán thành công. Mở liên kết sau để kích hoạt tài khoản Organizer: ` +
            `${this.frontendUrl()}/verify-email?token=${verifyToken}\n` +
            `Liên kết có hiệu lực ${settings.invitationLinkTtlDays} ngày.`,
        },
      });

      return created;
    });

    return {
      paymentId: payment.id,
      paymentStatus: PaymentStatus.Succeeded,
      subscription: {
        id: subscription.id,
        startsAt: subscription.startsAt,
        expiresAt: subscription.expiresAt,
      },
      organizerEmail: registration.organizer.email,
    };
  }

  // ===========================================================================
  // UC03 - Xác thực email Organizer
  // ===========================================================================
  async verifyEmail(dto: VerifyEmailDto): Promise<IVerifyEmailResult> {
    const token = await this.accountTokens.findUsable(
      dto.token,
      TokenPurpose.EmailVerification,
    );

    // GĐ3. Đánh dấu liên kết đã dùng và kích hoạt Organizer trong cùng transaction.
    await this.prisma.$transaction(async (tx) => {
      await this.accountTokens.consume(tx, token.id);
      await tx.user.update({
        where: { id: token.userId },
        data: {
          status: UserStatus.Active,
          activatedAt: token.user.activatedAt ?? new Date(),
        },
      });
    });

    // GĐ4. Thông tin cho màn hình "Email verified".
    return {
      email: token.user.email,
      organizationName: token.organization.name,
    };
  }

  // ===========================================================================
  // Hàm hỗ trợ
  // ===========================================================================

  /** Tìm đăng ký theo liên kết: băm chuỗi gốc rồi tra cột reopen_token_hash. */
  private async findByTokenOrThrow(rawToken: string) {
    const registration = await this.prisma.registration.findUnique({
      where: { reopenTokenHash: hashToken(rawToken) },
      include: { organization: true, organizer: true, plan: true },
    });
    if (!registration) {
      throw new NotFoundException({
        code: 'INVALID_LINK',
        message:
          'Liên kết đăng ký không hợp lệ hoặc đã được thay bằng liên kết mới hơn.',
      });
    }
    return registration;
  }

  /** BR-7: đăng ký chờ thanh toán đã quá hạn thì hủy và báo cho Guest. */
  private async assertNotExpired(registration: Registration): Promise<void> {
    const expired =
      registration.status === RegistrationStatus.Expired ||
      (registration.status === RegistrationStatus.PendingPayment &&
        registration.expiresAt.getTime() <= Date.now());
    if (!expired) return;

    if (registration.status === RegistrationStatus.PendingPayment) {
      await this.expireRegistration(registration);
    }
    throw new GoneException({
      code: 'REGISTRATION_EXPIRED',
      message: 'Đăng ký đã quá thời hạn chờ thanh toán. Vui lòng đăng ký lại.',
    });
  }

  /** BR-7: Registration -> Expired, Organization -> Cancelled, Organizer bị xóa mềm (BR-31). */
  private async expireRegistration(registration: Registration): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.registration.updateMany({
        where: {
          id: registration.id,
          status: RegistrationStatus.PendingPayment,
        },
        data: { status: RegistrationStatus.Expired },
      });
      if (updated.count === 0) return; // đã có request khác xử lý
      await tx.organization.update({
        where: { id: registration.organizationId },
        data: { status: OrganizationStatus.Cancelled },
      });
      await tx.user.update({
        where: { id: registration.organizerUserId },
        data: { deletedAt: now },
      });
    });
  }

  /**
   * BR-276 + BR-32: gửi lại liên kết thanh toán, tối đa N lần trong 24 giờ.
   * Chạm giới hạn thì im lặng bỏ qua (phản hồi trên màn hình vẫn trung tính).
   */
  private async resendReopenLink(
    registration: Registration,
    maxPer24h: number,
  ): Promise<void> {
    const now = new Date();
    const windowExpired =
      !registration.resendWindowStartedAt ||
      now.getTime() - registration.resendWindowStartedAt.getTime() >= DAY_MS;
    const currentCount = windowExpired ? 0 : registration.resendCount;
    if (currentCount >= maxPer24h) return;

    const organizer = await this.prisma.user.findUniqueOrThrow({
      where: { id: registration.organizerUserId },
    });
    const { rawToken, tokenHash } = generateSecretToken();

    await this.prisma.$transaction(async (tx) => {
      // Ghi đè mã băm: liên kết cũ tự mất hiệu lực (tenant_db mục 3.5).
      await tx.registration.update({
        where: { id: registration.id },
        data: {
          reopenTokenHash: tokenHash,
          resendCount: currentCount + 1,
          resendWindowStartedAt: windowExpired
            ? now
            : registration.resendWindowStartedAt,
        },
      });
      await this.outbox.enqueueEmail(tx, {
        aggregateType: 'Organization',
        aggregateId: registration.organizationId,
        organizationId: registration.organizationId,
        email: {
          to: organizer.email,
          subject: 'LearnUP - Liên kết thanh toán đăng ký',
          templateCode: 'REGISTRATION_REOPEN_LINK',
          body:
            `Xin chào ${organizer.fullName},\n` +
            `Mở liên kết sau để tiếp tục thanh toán: ${this.reopenLink(rawToken)}\n` +
            `Liên kết có hiệu lực tới ${registration.expiresAt.toISOString()}.`,
        },
      });
    });
  }

  private reopenLink(rawToken: string): string {
    return `${this.frontendUrl()}/register/pending-payment?token=${rawToken}`;
  }

  private frontendUrl(): string {
    return this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
  }
}
