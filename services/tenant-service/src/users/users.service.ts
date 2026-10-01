import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import type { CurrentUser, PageResponse } from '@learnup/ts-common';
import { STANDARD_ERROR_CODES, createPageResponse } from '@learnup/ts-common';
import { PrismaService } from '../prisma/prisma.service';
import { CourseServiceClient } from '../integrations/course-service.client';
import {
  TokenPurpose,
  UserRoleValue,
  UserStatus,
} from '../common/constants/tenant.constants';
import { ListAccountsQueryDto } from './dto/list-accounts-query.dto';
import { InstructorListItem } from './interfaces/account-list-item.interface';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly courseClient: CourseServiceClient,
  ) {}

  // ===========================================================================
  // UC12 - Xem danh sách Instructor
  // ===========================================================================
  async findInstructors(
    user: CurrentUser,
    query: ListAccountsQueryDto,
  ): Promise<PageResponse<InstructorListItem>> {
    // Tổ chức luôn lấy từ danh tính người gọi, không nhận từ client.
    const organizationId = this.organizationIdOf(user);
    const { page, pageSize } = query;

    // BR-37: xóa tài khoản là gán deleted_at, nên loại các dòng đã xóa.
    const where = {
      organizationId,
      role: UserRoleValue.Instructor,
      deletedAt: null,
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        // id là uuid v7 (tăng theo thời gian), thêm vào để thứ tự ổn định khi trùng created_at.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          fullName: true,
          email: true,
          department: true,
          status: true,
          activatedAt: true,
          createdAt: true,
        },
      }),
    ]);

    const expiredIds = await this.findExpiredInvitationUserIds(
      organizationId,
      rows
        .filter((row) => row.status === UserStatus.Pending)
        .map((row) => row.id),
    );
    const courseCounts = await this.countManagedCourses(
      user,
      rows.map((row) => row.id),
    );

    const items: InstructorListItem[] = rows.map((row) => ({
      ...row,
      invitationExpired: expiredIds.has(row.id),
      managedCourseCount: courseCounts ? (courseCounts[row.id] ?? 0) : null,
    }));
    return createPageResponse(items, page, pageSize, total);
  }

  /**
   * Trong các user Pending, ai không còn lời mời hiệu lực (BR-22, BR-278).
   * Lời mời hiệu lực = token Invitation chưa dùng, chưa thu hồi, expires_at > now.
   * Một truy vấn cho cả trang.
   */
  private async findExpiredInvitationUserIds(
    organizationId: string,
    pendingUserIds: string[],
  ): Promise<Set<string>> {
    if (pendingUserIds.length === 0) return new Set();

    const usable = await this.prisma.accountToken.findMany({
      where: {
        organizationId,
        userId: { in: pendingUserIds },
        purpose: TokenPurpose.Invitation,
        consumedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { userId: true },
    });
    const hasUsable = new Set(usable.map((token) => token.userId));
    return new Set(pendingUserIds.filter((id) => !hasUsable.has(id)));
  }

  /** Lỗi khi hỏi course-service không làm hỏng cả danh sách: trả null, ghi cảnh báo. */
  private async countManagedCourses(
    user: CurrentUser,
    instructorIds: string[],
  ): Promise<Record<string, number> | null> {
    if (instructorIds.length === 0) return {};
    try {
      return await this.courseClient.countCourseChainsByInstructors(
        user,
        instructorIds,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Không lấy được số Course phụ trách từ course-service: ${reason}`,
      );
      return null;
    }
  }

  private organizationIdOf(user: CurrentUser): string {
    if (!user.organizationId) {
      throw new ForbiddenException({
        code: STANDARD_ERROR_CODES.FORBIDDEN,
        message: 'Tài khoản không thuộc Organization nào.',
      });
    }
    return user.organizationId;
  }
}
