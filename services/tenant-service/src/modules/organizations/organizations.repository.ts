import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';
import { SubscriptionStatus } from '../../common/constants/tenant.constants';
import { BaseRepository } from '../../common/repository/base.repository';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

const PROFILE_SELECT = {
  id: true,
  name: true,
  taxCode: true,
  address: true,
  contactPhone: true,
  contactEmail: true,
  logoFileKey: true,
  timezone: true,
  status: true,
  updatedAt: true,
} as const;

@Injectable()
export class OrganizationsRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  findProfile(organizationId: string, tx?: Prisma.TransactionClient) {
    return this.db(tx).organization.findUnique({
      where: { id: organizationId },
      select: PROFILE_SELECT,
    });
  }

  /** Tên chuẩn của múi giờ theo PostgreSQL, nơi learning-service tra múi giờ; null nếu không có. */
  async findCanonicalTimezone(name: string): Promise<string | null> {
    const rows = await this.prisma.$queryRaw<Array<{ name: string }>>`
      SELECT name FROM pg_timezone_names
      WHERE lower(name) = lower(${name})
        AND name NOT LIKE 'posix/%' AND name NOT LIKE 'right/%'
      LIMIT 1`;
    return rows[0]?.name ?? null;
  }

  /** Khóa dòng tổ chức tới hết transaction, để hai lượt sửa hoặc thay logo chạy lần lượt. */
  async lockOrganization(organizationId: string, tx: Prisma.TransactionClient) {
    const rows = await tx.$queryRaw<Array<{ status: string }>>`
      SELECT status FROM organizations WHERE id = ${organizationId}::uuid FOR UPDATE`;
    return rows[0] ?? null;
  }

  findCurrentSubscriptionStatus(
    organizationId: string,
    tx: Prisma.TransactionClient,
  ) {
    return tx.subscription.findFirst({
      where: {
        organizationId,
        status: {
          in: [
            SubscriptionStatus.Active,
            SubscriptionStatus.Grace,
            SubscriptionStatus.Suspended,
          ],
        },
      },
      select: { status: true },
    });
  }

  updateProfile(
    organizationId: string,
    data: Prisma.OrganizationUpdateInput,
    tx: Prisma.TransactionClient,
  ) {
    return tx.organization.update({
      where: { id: organizationId },
      data,
      select: PROFILE_SELECT,
    });
  }
}
