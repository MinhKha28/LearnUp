import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  UserRoleValue,
  UserStatus,
} from '../../common/constants/tenant.constants';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActiveOrganizer(organizationId: string) {
    return this.prisma.user.findFirst({
      where: {
        organizationId,
        role: UserRoleValue.Organizer,
        status: UserStatus.Active,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
      },
    });
  }
}
