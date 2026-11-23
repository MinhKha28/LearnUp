import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  UserRoleValue,
  UserStatus,
} from '../../common/constants/tenant.constants';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Business rule: each Organization has one active Organizer.
  // This lookup is not meant to choose between multiple active accounts.
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
  // UC23: list only active, activated Instructors in this Organization.
  findTransferCandidates(organizationId: string, excludeInstructorId: string) {
    return this.prisma.user.findMany({
      where: {
        organizationId,
        role: UserRoleValue.Instructor,
        status: UserStatus.Active,
        activatedAt: { not: null },
        deletedAt: null,
        id: { not: excludeInstructorId },
      },
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
      select: { id: true, fullName: true },
    });
  }

  // UC23: recheck the specific receiving Instructor before transferring ownership.
  findEligibleTransferReceiver(organizationId: string, instructorId: string) {
    return this.prisma.user.findFirst({
      where: {
        id: instructorId,
        organizationId,
        role: UserRoleValue.Instructor,
        status: UserStatus.Active,
        activatedAt: { not: null },
        deletedAt: null,
      },
      select: { id: true, fullName: true },
    });
  }
}
