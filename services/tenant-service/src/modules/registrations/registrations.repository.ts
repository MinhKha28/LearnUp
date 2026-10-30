import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';
import {
  OrganizationStatus,
  PaymentStatus,
  RegistrationStatus,
  UserStatus,
} from '../../common/constants/tenant.constants';
import { BaseRepository } from '../../common/repository/base.repository';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { IResendCounter } from './interfaces/resend-counter.interface';

export const REGISTRATION_EMAIL_LOCK_NAMESPACE = 2402;

@Injectable()
export class RegistrationsRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  // ---------------------------------------------------------------------------
  // UC02 - Đăng ký Organization
  // ---------------------------------------------------------------------------

  /**
   * Thử lấy khóa theo email trong transaction tx, tự nhả khi tx kết thúc. Trả false nếu lượt đăng ký khác
   * đang giữ. Namespace riêng cho UC02 để không trùng khóa advisory của chức năng khác.
   */
  async tryLockRegistrationEmail(
    email: string,
    tx: Prisma.TransactionClient,
  ): Promise<boolean> {
    const rows = await tx.$queryRaw<{ locked: boolean }[]>`
      SELECT pg_try_advisory_xact_lock(${REGISTRATION_EMAIL_LOCK_NAMESPACE}::int, hashtext(lower(${email}))) AS locked`;
    return rows[0]?.locked === true;
  }

  findPlanById(planId: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).subscriptionPlan.findUnique({ where: { id: planId } });
  }

  /** BR-30: email là duy nhất trong các tài khoản chưa bị xóa mềm. */
  findActiveUserByEmail(email: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).user.findFirst({ where: { email, deletedAt: null } });
  }

  /** Đăng ký đang chờ thanh toán của Organizer, kèm tổ chức và Organizer để gửi thư. */
  findPendingByOrganizer(
    organizerUserId: string,
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).registration.findFirst({
      where: { organizerUserId, status: RegistrationStatus.PendingPayment },
      include: { organization: true, organizer: true },
    });
  }

  createOrganization(
    data: Prisma.OrganizationUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).organization.create({ data });
  }

  createOrganizer(
    data: Prisma.UserUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).user.create({ data });
  }

  createRegistration(
    data: Prisma.RegistrationUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).registration.create({ data });
  }

  // ---------------------------------------------------------------------------
  // BR-7: hủy đăng ký quá hạn hoặc bị thay thế
  // ---------------------------------------------------------------------------

  /** Chỉ đổi khi còn PendingPayment; trả số dòng (0 = request khác đã xử lý). */
  async markExpiredIfPending(
    registrationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const result = await this.db(tx).registration.updateMany({
      where: { id: registrationId, status: RegistrationStatus.PendingPayment },
      data: { status: RegistrationStatus.Expired },
    });
    return result.count;
  }

  cancelOrganization(organizationId: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).organization.update({
      where: { id: organizationId },
      data: { status: OrganizationStatus.Cancelled },
    });
  }

  /** BR-31: xóa mềm Organizer để email được dùng lại. */
  softDeleteUser(
    userId: string,
    deletedAt: Date,
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).user.update({
      where: { id: userId },
      data: { deletedAt },
    });
  }

  /** TH B (BR-276): ghi đè mã băm liên kết (liên kết cũ mất hiệu lực) và bộ đếm gửi lại. */
  updateReopenToken(
    registrationId: string,
    tokenHash: Uint8Array<ArrayBuffer>,
    counter: IResendCounter,
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).registration.update({
      where: { id: registrationId },
      data: { reopenTokenHash: tokenHash, ...counter },
    });
  }

  /** UC03.1: mã xác thực và liên kết mới thay cho cái cũ, số lần nhập sai về 0 (BR-13, BR-40). */
  updateVerificationCode(
    registrationId: string,
    data: {
      reopenTokenHash: Uint8Array<ArrayBuffer>;
      otpHash: Uint8Array<ArrayBuffer>;
      otpExpiresAt: Date;
    },
    counter: IResendCounter,
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).registration.update({
      where: { id: registrationId },
      data: { ...data, otpFailedAttempts: 0, ...counter },
    });
  }

  // ---------------------------------------------------------------------------
  // UC02.1 / UC03 - liên kết mở lại đăng ký
  // ---------------------------------------------------------------------------

  /** Tìm theo mã băm liên kết, kèm tổ chức, Organizer và gói (màn tóm tắt + thanh toán). */
  findByReopenTokenHash(
    tokenHash: Uint8Array<ArrayBuffer>,
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).registration.findUnique({
      where: { reopenTokenHash: tokenHash },
      include: { organization: true, organizer: true, plan: true },
    });
  }

  /** BR-6: mở liên kết = đã xác thực email; chỉ ghi khi chưa xác thực. */
  markVerifiedByLink(
    registrationId: string,
    verifiedAt: Date,
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).registration.updateMany({
      where: { id: registrationId, emailVerifiedAt: null },
      data: {
        emailVerifiedAt: verifiedAt,
        otpHash: null,
        otpExpiresAt: null,
        otpFailedAttempts: 0,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // UC03 - xác thực bằng mã OTP (BR-337)
  // ---------------------------------------------------------------------------

  findPendingByOrganizerEmail(email: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).registration.findFirst({
      where: {
        status: RegistrationStatus.PendingPayment,
        organizer: { email, deletedAt: null },
      },
    });
  }

  /**
   * Khóa dòng (SELECT ... FOR UPDATE) rồi đọc bản mới nhất.
   * BẮT BUỘC gọi trong transaction: khóa giữ tới khi transaction kết thúc,
   * nên các request nhập mã song song phải xếp hàng, không cùng lúc vượt giới hạn sai.
   */
  async findByIdForUpdate(
    registrationId: string,
    tx: Prisma.TransactionClient,
  ) {
    await tx.$queryRaw`SELECT id FROM registrations WHERE id = ${registrationId}::uuid FOR UPDATE`;
    return tx.registration.findUniqueOrThrow({ where: { id: registrationId } });
  }

  incrementOtpFailedAttempts(
    registrationId: string,
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).registration.update({
      where: { id: registrationId },
      data: { otpFailedAttempts: { increment: 1 } },
    });
  }

  /** Đúng mã: xác thực, xóa mã, phát liên kết mới (liên kết trong thư 1 mất hiệu lực). */
  markVerifiedByOtp(
    registrationId: string,
    verifiedAt: Date,
    tokenHash: Uint8Array<ArrayBuffer>,
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).registration.update({
      where: { id: registrationId },
      data: {
        emailVerifiedAt: verifiedAt,
        otpHash: null,
        otpExpiresAt: null,
        otpFailedAttempts: 0,
        reopenTokenHash: tokenHash,
      },
    });
  }
  // ---------------------------------------------------------------------------
  // UC02.1 - Thanh toán
  // ---------------------------------------------------------------------------

  createPayment(
    data: Prisma.PaymentUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).payment.create({ data });
  }

  markPaymentFailed(
    paymentId: string,
    failureReason: string | null,
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.Failed, failureReason },
    });
  }

  /** Chỉ đổi khi còn PendingPayment: chống 2 request thanh toán cùng lúc. Trả số dòng. */
  async markPaidIfPending(
    registrationId: string,
    paidAt: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const result = await this.db(tx).registration.updateMany({
      where: { id: registrationId, status: RegistrationStatus.PendingPayment },
      data: { status: RegistrationStatus.Paid, paidAt },
    });
    return result.count;
  }

  createSubscription(
    data: Prisma.SubscriptionUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).subscription.create({ data });
  }

  markPaymentSucceeded(
    paymentId: string,
    params: {
      paidAt: Date;
      subscriptionId: string;
      providerReference: string | null;
    },
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.Succeeded, ...params },
    });
  }

  activateOrganization(organizationId: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).organization.update({
      where: { id: organizationId },
      data: { status: OrganizationStatus.Active },
    });
  }

  /** BR-20: Organizer được kích hoạt ngay khi thanh toán thành công. */
  activateOrganizer(
    userId: string,
    activatedAt: Date,
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).user.update({
      where: { id: userId },
      data: { status: UserStatus.Active, activatedAt },
    });
  }
}
