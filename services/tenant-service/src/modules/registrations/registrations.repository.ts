import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';
import {
  OrganizationStatus,
  RegistrationStatus,
} from '../../common/constants/tenant.constants';
import { BaseRepository } from '../../common/repository/base.repository';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { IResendCounter } from './interfaces/resend-counter.interface';

@Injectable()
export class RegistrationsRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  // ---------------------------------------------------------------------------
  // UC02 - Đăng ký Organization
  // ---------------------------------------------------------------------------

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
}
