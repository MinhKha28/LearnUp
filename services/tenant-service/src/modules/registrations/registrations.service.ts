import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v7 as uuidv7 } from 'uuid';
import { Prisma, Registration } from '../../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { OutboxService } from '../outbox/outbox.service';
import { IdentityClient } from '../../infrastructure/clients/identity/identity.client';
import {
  DAY_MS,
  HOUR_MS,
  MINUTE_MS,
  OrganizationStatus,
  PaymentKind,
  PaymentStatus,
  RegistrationStatus,
  SubscriptionStatus,
  TokenPurpose,
  UserRoleValue,
  UserStatus,
} from '../../common/constants/tenant.constants';
import { generateOtp, hashOtp, isOtpMatch } from '../../common/utils/otp.util';
import {
  renderReopenLinkEmail,
  renderVerificationEmail,
} from '../../common/email-templates/registration-emails';
import { ICreateRegistrationResult } from './interfaces/create-registration-result.interface';
import { IResendCounter } from './interfaces/resend-counter.interface';

import { generateSecretToken, hashToken } from '../../common/utils/token.util';
import { CreateRegistrationDto } from './dto/create-registrations.dto';
import { IRegistrationSummary } from './interfaces/registration-summary.interface';
import { AccountTokensService } from '../account-tokens/account-tokens.service';
import { MockPaymentGateway } from '../payments/mock-payment.gateway';
import { PayRegistrationDto } from './dto/pay-registration.dto';
import { VerifyEmailOtpDto } from './dto/verify-email-otp.dto';
import { IVerifyEmailOtpResult } from './interfaces/verify-email-otp-result.interface';
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

  // ===========================================================================
  // UC02 - Đăng ký Organization (BR-4, BR-5, BR-6, BR-276, BR-337)
  // ===========================================================================
  async create(dto: CreateRegistrationDto): Promise<ICreateRegistrationResult> {
    const settings = await this.settingsService.get();
    // Phản hồi trung tính, dùng cho mọi trường hợp (BR-276).
    const result: ICreateRegistrationResult = {
      email: dto.organizer.email,
      otpTtlMinutes: settings.emailOtpTtlMinutes,
      message:
        'Nếu thông tin hợp lệ, mã xác thực đã được gửi tới email của bạn.',
    };

    // BR-3, BR-4: phải chọn một gói đang được cung cấp.
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: dto.planId },
    });
    if (!plan || !plan.isOffered) {
      throw new BadRequestException({
        code: 'PLAN_NOT_AVAILABLE',
        message: 'Gói dịch vụ không tồn tại hoặc đã ngừng cung cấp.',
      });
    }

    // BR-30: email là duy nhất trong các tài khoản chưa bị xóa.
    let carriedCounter: IResendCounter | null = null;
    const existingUser = await this.prisma.user.findFirst({
      where: { email: dto.organizer.email, deletedAt: null },
    });
    if (existingUser) {
      const pending = await this.prisma.registration.findFirst({
        where: {
          organizerUserId: existingUser.id,
          status: RegistrationStatus.PendingPayment,
        },
        include: { organization: true, organizer: true },
      });
      if (!pending) {
        throw new ConflictException({
          code: 'EMAIL_ALREADY_USED',
          message: 'Email đã được sử dụng cho một tài khoản khác.',
        });
      }

      if (pending.expiresAt.getTime() <= Date.now()) {
        // Trường hợp E: đăng ký cũ đã quá hạn (BR-7) → hủy, rồi tạo mới như bình thường.
        await this.expireRegistration(pending);
      } else {
        // BR-276 + BR-32: mỗi thư tính vào giới hạn theo email trong 24 giờ.
        const counter = this.nextResendCounter(
          pending,
          settings.maxLinkResendsPer24h,
        );
        if (!counter) return result; // Trường hợp D: đã chạm giới hạn, không gửi, không tạo.

        if (pending.emailVerifiedAt) {
          // Trường hợp B: đã xác thực → gửi lại liên kết, không tạo đăng ký mới.
          await this.resendReopenLink(pending, counter);
          return result;
        }
        // Trường hợp C: chưa xác thực → thay bằng đăng ký mới, mang theo bộ đếm.
        await this.expireRegistration(pending);
        carriedCounter = counter;
      }
    }

    // Mật khẩu không lưu ở tenant: sinh sẵn id rồi gửi sang identity TRƯỚC khi ghi DB.
    const organizerId = uuidv7();
    const registrationId = uuidv7(); // cần trước để gắn vào mã băm OTP
    await this.identity.setPassword(organizerId, dto.organizer.password);

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + settings.pendingRegistrationTtlHours * HOUR_MS,
    );
    const { rawToken, tokenHash } = generateSecretToken();
    // BR-337: mã 6 số, hạn theo tham số 21, chỉ lưu HMAC.
    const otp = generateOtp();
    const otpExpiresAt = new Date(
      now.getTime() + settings.emailOtpTtlMinutes * MINUTE_MS,
    );

    try {
      await this.prisma.$transaction(async (tx) => {
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

        // BR-5: Organizer chưa kích hoạt, email chưa xác thực.
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
        await tx.registration.create({
          data: {
            id: registrationId,
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
            otpHash: hashOtp(this.otpSecret(), registrationId, otp),
            otpExpiresAt,
            // Trường hợp C mang bộ đếm của đăng ký cũ (tenant_db mục 3.5).
            resendCount: carriedCounter?.resendCount ?? 0,
            resendWindowStartedAt:
              carriedCounter?.resendWindowStartedAt ?? null,
          },
        });

        // BR-6: thư thứ nhất chứa mã xác thực và liên kết mở lại đăng ký.
        const email = renderVerificationEmail({
          fullName: dto.organizer.fullName,
          organizationName: organization.name,
          code: otp,
          codeTtlMinutes: settings.emailOtpTtlMinutes,
          reopenLink: this.reopenLink(rawToken),
          registrationExpiresAt: expiresAt,
        });
        await this.outbox.enqueueEmail(tx, {
          aggregateType: 'Organization',
          aggregateId: organization.id,
          organizationId: organization.id,
          email: {
            to: dto.organizer.email,
            subject: email.subject,
            templateCode: email.templateCode,
            body: email.html,
          },
        });
      });
    } catch (error) {
      // P2002: hai request cùng email gửi đồng thời; request đến sau trả phản hồi trung tính.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return result;
      }
      throw error;
    }
    return result;
  }

  // ===========================================================================
  // UC02.1 - Xem tóm tắt đăng ký theo liên kết (màn thanh toán)
  // ===========================================================================
  async getByToken(rawToken: string): Promise<IRegistrationSummary> {
    const registration = await this.findByTokenOrThrow(rawToken);
    await this.assertNotExpired(registration);
    // BR-6: liên kết chỉ có trong thư gửi tới chính email đó, nên mở liên kết = đã xác thực email.
    if (
      registration.status === RegistrationStatus.PendingPayment &&
      !registration.emailVerifiedAt
    ) {
      await this.prisma.registration.updateMany({
        where: { id: registration.id, emailVerifiedAt: null },
        data: {
          emailVerifiedAt: new Date(),
          otpHash: null,
          otpExpiresAt: null,
          otpFailedAttempts: 0,
        },
      });
    }

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
  // UC03 - Xác thực email bằng mã OTP (BR-6, BR-337)
  // ===========================================================================
  async verifyEmailOtp(dto: VerifyEmailOtpDto): Promise<IVerifyEmailOtpResult> {
    const settings = await this.settingsService.get();
    const now = new Date();
    // Một lỗi chung cho "không có đăng ký" và "sai mã": không lộ email nào đang đăng ký.
    const invalidOtp = new BadRequestException({
      code: 'OTP_INVALID',
      message: 'Mã xác thực không đúng.',
    });

    const registration = await this.prisma.registration.findFirst({
      where: {
        status: RegistrationStatus.PendingPayment,
        organizer: { email: dto.email, deletedAt: null },
      },
    });
    if (!registration || registration.expiresAt.getTime() <= now.getTime())
      throw invalidOtp;

    const { rawToken, tokenHash } = generateSecretToken();
    const outcome = await this.prisma.$transaction(async (tx) => {
      // Khóa dòng: các request song song phải xếp hàng, không cùng lúc vượt giới hạn sai.
      await tx.$queryRaw`SELECT id FROM registrations WHERE id = ${registration.id}::uuid FOR UPDATE`;
      const current = await tx.registration.findUniqueOrThrow({
        where: { id: registration.id },
      });

      if (
        current.status !== RegistrationStatus.PendingPayment ||
        !current.otpHash ||
        !current.otpExpiresAt
      ) {
        return 'invalid' as const; // đã xác thực rồi hoặc không còn mã
      }
      if (
        current.otpExpiresAt.getTime() <= now.getTime() ||
        current.otpFailedAttempts >= settings.emailOtpMaxFailedAttempts
      ) {
        return 'expired' as const; // BR-337: hết hạn hoặc sai quá số lần → phải yêu cầu mã mới
      }
      if (!isOtpMatch(this.otpSecret(), current.id, dto.otp, current.otpHash)) {
        await tx.registration.update({
          where: { id: current.id },
          data: { otpFailedAttempts: { increment: 1 } },
        });
        return 'wrong' as const;
      }

      // Đúng mã: xác thực, xóa mã, phát liên kết mở lại mới (liên kết trong thư 1 mất hiệu lực).
      await tx.registration.update({
        where: { id: current.id },
        data: {
          emailVerifiedAt: now,
          otpHash: null,
          otpExpiresAt: null,
          otpFailedAttempts: 0,
          reopenTokenHash: tokenHash,
        },
      });
      return 'verified' as const;
    });

    if (outcome === 'verified') {
      return {
        paymentToken: rawToken,
        registrationExpiresAt: registration.expiresAt,
      };
    }
    if (outcome === 'expired') {
      throw new GoneException({
        code: 'OTP_EXPIRED',
        message: 'Mã xác thực đã hết hiệu lực. Vui lòng yêu cầu mã mới.',
      });
    }
    throw invalidOtp;
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
   * BR-32, BR-276: tính bộ đếm thư mới trong khung 24 giờ.
   * Trả null nếu đã chạm giới hạn (khi đó không gửi thư, không tạo đăng ký mới).
   */
  private nextResendCounter(
    registration: Registration,
    maxPer24h: number,
  ): IResendCounter | null {
    const now = new Date();
    const windowExpired =
      !registration.resendWindowStartedAt ||
      now.getTime() - registration.resendWindowStartedAt.getTime() >= DAY_MS;
    const currentCount = windowExpired ? 0 : registration.resendCount;
    if (currentCount >= maxPer24h) return null;
    return {
      resendCount: currentCount + 1,
      resendWindowStartedAt: windowExpired
        ? now
        : registration.resendWindowStartedAt!,
    };
  }

  /** Trường hợp B (BR-276): email đã xác thực → ghi đè liên kết, gửi lại thư liên kết. */
  private async resendReopenLink(
    registration: Prisma.RegistrationGetPayload<{
      include: { organization: true; organizer: true };
    }>,
    counter: IResendCounter,
  ): Promise<void> {
    const { rawToken, tokenHash } = generateSecretToken();
    const email = renderReopenLinkEmail({
      fullName: registration.organizer.fullName,
      organizationName: registration.organization.name,
      reopenLink: this.reopenLink(rawToken),
      registrationExpiresAt: registration.expiresAt,
    });

    await this.prisma.$transaction(async (tx) => {
      // Ghi đè mã băm: liên kết cũ tự mất hiệu lực (tenant_db mục 3.5).
      await tx.registration.update({
        where: { id: registration.id },
        data: { reopenTokenHash: tokenHash, ...counter },
      });
      await this.outbox.enqueueEmail(tx, {
        aggregateType: 'Organization',
        aggregateId: registration.organizationId,
        organizationId: registration.organizationId,
        email: {
          to: registration.organizer.email,
          subject: email.subject,
          templateCode: email.templateCode,
          body: email.html,
        },
      });
    });
  }

  private otpSecret(): string {
    return this.config.getOrThrow<string>('EMAIL_OTP_SECRET');
  }

  private reopenLink(rawToken: string): string {
    return `${this.frontendUrl()}/register/pending-payment?token=${rawToken}`;
  }

  private frontendUrl(): string {
    return this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
  }
}
