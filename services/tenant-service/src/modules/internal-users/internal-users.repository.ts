import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { BaseRepository } from '../../common/repository/base.repository';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export interface LookupUserItem {
  userId: string;
  role: string;
  status: string;
  activatedAt: Date | null;
  deletedAt: Date | null;
  fullName: string;
  email: string;
}

export function lookupUsersQuery(organizationId: string, userIds: string[]) {
  return Prisma.sql`
    SELECT id AS "userId", role, status, activated_at AS "activatedAt",
           deleted_at AS "deletedAt", full_name AS "fullName", email
    FROM users
    WHERE organization_id = ${organizationId}::uuid
      AND id = ANY(${userIds}::uuid[])
  `;
}

@Injectable()
export class InternalUsersRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  lookup(organizationId: string, userIds: string[]): Promise<LookupUserItem[]> {
    return this.db().$queryRaw<LookupUserItem[]>(
      lookupUsersQuery(organizationId, userIds),
    );
  }
}
