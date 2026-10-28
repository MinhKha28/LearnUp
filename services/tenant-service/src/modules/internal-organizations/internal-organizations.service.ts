import { Injectable, NotFoundException } from '@nestjs/common';
import { SubscriptionStatus } from '../../common/constants/tenant.constants';
import { organizerReadOnlyEndsAt } from '../../common/utils/organizer-read-only.util';
import { IOrganizationAccess } from './interfaces/organization-access.interface';
import { InternalOrganizationsRepository } from './internal-organizations.repository';

const organizationNotFound = () =>
  new NotFoundException({
    code: 'ORGANIZATION_NOT_FOUND',
    message: 'Không tìm thấy tổ chức.',
  });

@Injectable()
export class InternalOrganizationsService {
  constructor(private readonly repository: InternalOrganizationsRepository) {}

  /**
   * Trạng thái truy cập cho learning và achievement-reporting (BR-22, BR-23, BR-24; múi giờ BR-55).
   * Chuẩn @ServiceCall (#145): x-organization-id phải trùng tổ chức trên path; thiếu, lệch hoặc không có
   * tổ chức đều trả cùng một 404 để không lộ tổ chức khác có tồn tại hay không.
   */
  async access(
    headerOrganizationId: string | undefined,
    organizationId: string,
  ): Promise<IOrganizationAccess> {
    this.assertSameOrganization(headerOrganizationId, organizationId);
    const organization = await this.repository.findOrganization(organizationId);
    if (!organization) throw organizationNotFound();

    const subscription =
      await this.repository.findCurrentSubscription(organizationId);
    const suspended = subscription?.status === SubscriptionStatus.Suspended;
    return {
      organizationId: organization.id,
      organizationStatus: organization.status,
      subscriptionStatus: subscription?.status ?? SubscriptionStatus.Ended,
      readOnlyEndsAt:
        suspended && subscription
          ? organizerReadOnlyEndsAt(subscription)
          : null,
      timezone: organization.timezone,
    };
  }

  private assertSameOrganization(
    headerOrganizationId: string | undefined,
    organizationId: string,
  ): void {
    if (
      !headerOrganizationId ||
      headerOrganizationId.toLowerCase() !== organizationId.toLowerCase()
    ) {
      throw organizationNotFound();
    }
  }
}
