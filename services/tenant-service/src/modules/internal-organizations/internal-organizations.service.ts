import {
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { IStorageProvider } from '@learnup/ts-storage';
import { SubscriptionStatus } from '../../common/constants/tenant.constants';
import { organizerReadOnlyEndsAt } from '../../common/utils/organizer-read-only.util';
import { STORAGE_PROVIDER } from '../../infrastructure/storage/storage.constants';
import { ICertificateLogo } from './interfaces/certificate-logo.interface';
import { ICertificateProfile } from './interfaces/certificate-profile.interface';
import { IOrganizationAccess } from './interfaces/organization-access.interface';
import { InternalOrganizationsRepository } from './internal-organizations.repository';

const organizationNotFound = () =>
  new NotFoundException({
    code: 'ORGANIZATION_NOT_FOUND',
    message: 'Không tìm thấy tổ chức.',
  });

@Injectable()
export class InternalOrganizationsService {
  constructor(
    private readonly repository: InternalOrganizationsRepository,
    @Inject(STORAGE_PROVIDER) private readonly storage: IStorageProvider,
  ) {}

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

  /**
   * Hồ sơ tổ chức cho Certificate (#148): trả về bất kể trạng thái tổ chức, vì Certificate có thể được cấp
   * sau khi tổ chức đổi trạng thái. logo null chỉ khi tổ chức chưa có logo; có logo mà không dựng được URL thì
   * trả 503, không bao giờ giả làm "không có logo".
   */
  async certificateProfile(
    headerOrganizationId: string | undefined,
    organizationId: string,
  ): Promise<ICertificateProfile> {
    this.assertSameOrganization(headerOrganizationId, organizationId);
    const organization = await this.repository.findOrganization(organizationId);
    if (!organization) throw organizationNotFound();

    return {
      organizationId: organization.id,
      name: organization.name,
      logo: organization.logoFileKey
        ? this.logo(organization.logoFileKey)
        : null,
      timezone: organization.timezone,
    };
  }

  private logo(logoFileKey: string): ICertificateLogo {
    let url: string;
    try {
      url = this.storage.getUrl(logoFileKey, 'image');
    } catch {
      throw new ServiceUnavailableException({
        code: 'STORAGE_UNAVAILABLE',
        message: 'Không lấy được logo của tổ chức.',
      });
    }
    return { url, expiresAt: null, mimeType: null, sizeBytes: null };
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
