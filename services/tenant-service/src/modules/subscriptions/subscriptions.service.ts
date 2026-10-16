import type { CurrentUser } from '@learnup/ts-common';
import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { DAY_MS, UserRoleValue } from '../../common/constants/tenant.constants';
import { CourseServiceClient } from '../../infrastructure/clients/course/course-service.client';
import type { IOrganizationCourseUsage } from '../../infrastructure/clients/course/interfaces/organization-course-usage.interface';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import {
  ISubscriptionOverview,
  IUsageItem,
} from './interfaces/subscription-overview.interface';
import { SubscriptionsRepository } from './subscriptions.repository';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly subscriptionsRepository: SubscriptionsRepository,
    private readonly settingsService: PlatformSettingsService,
    private readonly courseService: CourseServiceClient,
  ) {}

  async getOverview(user: CurrentUser): Promise<ISubscriptionOverview> {
    const organizationId = user.organizationId;
    if (!organizationId) {
      throw new ForbiddenException({
        code: 'ORGANIZATION_REQUIRED',
        message: 'Tài khoản không thuộc tổ chức nào.',
      });
    }

    const [organization, current, scheduled, settings, learners, instructors] =
      await Promise.all([
        this.subscriptionsRepository.findOrganization(organizationId),
        this.subscriptionsRepository.findCurrent(organizationId),
        this.subscriptionsRepository.findScheduled(organizationId),
        this.settingsService.get(),
        this.subscriptionsRepository.countSeats(
          organizationId,
          UserRoleValue.Learner,
        ),
        this.subscriptionsRepository.countSeats(
          organizationId,
          UserRoleValue.Instructor,
        ),
      ]);
    const courseUsage = await this.loadCourseUsage(user);
    const threshold = settings.usageWarningThresholdPercent;
    const item = (used: number | null, limit: number) =>
      this.usageItem(used, limit, threshold);

    return {
      organizationName: organization?.name ?? '',
      subscription: current
        ? {
            id: current.id,
            planName: current.plan.name,
            price: Number(current.price),
            status: current.status,
            startsAt: current.startsAt,
            expiresAt: current.expiresAt,
            graceEndsAt: current.graceEndsAt,
            readOnlyEndsAt: current.readOnlyEndsAt,
            daysRemaining: Math.max(
              0,
              Math.ceil((current.expiresAt.getTime() - Date.now()) / DAY_MS),
            ),
          }
        : null,
      scheduledRenewal: scheduled
        ? {
            planName: scheduled.plan.name,
            startsAt: scheduled.startsAt,
            expiresAt: scheduled.expiresAt,
          }
        : null,
      usageWarningThresholdPercent: threshold,
      graceDays: settings.subscriptionGraceDays,
      organizerReadOnlyDays: settings.organizerReadOnlyDays,
      courseUsageAvailable: courseUsage !== null,
      usage: {
        learners: item(learners, current?.maxLearners ?? 0),
        instructors: item(instructors, current?.maxInstructors ?? 0),
        courses: item(
          courseUsage?.courseChains ?? null,
          current?.maxCourseChains ?? 0,
        ),
        storageBytes: item(
          courseUsage?.storageBytes ?? null,
          Number(current?.maxStorageBytes ?? 0),
        ),
      },
    };
  }

  private async loadCourseUsage(
    user: CurrentUser,
  ): Promise<IOrganizationCourseUsage | null> {
    try {
      return await this.courseService.getOrganizationUsage(user);
    } catch (error) {
      this.logger.warn(
        `Không lấy được mức dùng Course/dung lượng: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private usageItem(
    used: number | null,
    limit: number,
    threshold: number,
  ): IUsageItem {
    if (used === null) {
      return { used: null, limit, percent: null, warning: false };
    }
    const percent =
      limit > 0 ? Math.round((used / limit) * 100) : used > 0 ? 100 : 0;
    return { used, limit, percent, warning: percent >= threshold };
  }
}
