import {
  BadRequestException,
  ConflictException,
  Injectable,
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
  RegistrationStatus,
  UserRoleValue,
  UserStatus,
} from '../common/constants/tenant.constants';
import { generateSecretToken } from '../common/utils/token.util';
import { CreateRegistrationDto } from './dto/create-registrations.dto';

@Injectable()
export class RegistrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly settingsService: PlatformSettingsService,
    private readonly outbox: OutboxService,
    private readonly identity: IdentityClient,
  ) {}

  // ===========================================================================
  // UC02 - Đăng ký Organization
  // ===========================================================================
  async create(dto: CreateRegistrationDto) {
    const settings = await this.settingsService.get();

    // ---- GĐ2a. BR-3, BR-4: phải chọn một gói đang được cung cấp.
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: dto.planId },
    });
    if (!plan || !plan.isOffered) {
      throw new BadRequestException({
        code: 'PLAN_NOT_AVAILABLE',
        message: 'Gói dịch vụ không tồn tại hoặc đã ngừng cung cấp.',
      });
    }

    // ---- GĐ2b. BR-30: email là duy nhất trong các tài khoản chưa bị xóa.
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
        // BR-276: không tạo đăng ký mới, gửi lại liên kết thanh toán (tính vào BR-32).
        await this.resendReopenLink(pending, settings.maxLinkResendsPer24h);
        return {
          resent: true,
          message:
            'Email này đang có một đăng ký chờ thanh toán. Vui lòng kiểm tra hộp thư để tiếp tục.',
        };
      }

      if (pending) {
        // Đăng ký đã quá hạn nhưng lịch chạy chưa kịp hủy: hủy ngay (BR-7)
        // để Guest đăng ký lại được bằng chính email này.
        await this.expireRegistration(pending);
      } else {
        throw new ConflictException({
          code: 'EMAIL_ALREADY_USED',
          message: 'Email đã được sử dụng cho một tài khoản khác.',
        });
      }
    }

    // ---- GĐ3. Mật khẩu không lưu ở tenant. Sinh sẵn user_id rồi gửi sang identity-service
    // TRƯỚC khi ghi DB: nếu identity lỗi thì chưa có gì trong tenant_db.
    const organizerId = uuidv7();
    await this.identity.setPassword(organizerId, dto.organizer.password);

    // ---- GĐ4. Ghi DB + outbox trong MỘT transaction.
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
  // Hàm hỗ trợ
  // ===========================================================================

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
