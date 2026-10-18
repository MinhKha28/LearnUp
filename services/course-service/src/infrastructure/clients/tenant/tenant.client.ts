import { HttpService } from '@nestjs/axios';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CurrentUser } from '@learnup/ts-common';
import { firstValueFrom } from 'rxjs';

import type {
  TenantApiResponse,
  TenantInstructor,
  TenantMaterialUploadPolicy,
} from './tenant.interface';

@Injectable()
export class TenantClient {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private buildHeaders(user: CurrentUser) {
    return {
      'x-internal-key': this.configService.getOrThrow<string>(
        'INTERNAL_SERVICE_KEY',
      ),
      'x-user-id': user.userId,
      'x-organization-id': user.organizationId!,
      'x-user-role': user.role,
    };
  }

  async getInstructors(
    user: CurrentUser,
    instructorIds: string[],
  ): Promise<TenantInstructor[]> {
    if (instructorIds.length === 0) {
      return [];
    }

    const baseUrl = this.configService.getOrThrow<string>('TENANT_SERVICE_URL');

    try {
      const response = await firstValueFrom(
        this.httpService.post<TenantApiResponse<TenantInstructor[]>>(
          `${baseUrl}/api/v1/users/batch`,
          {
            userIds: instructorIds,
          },
          {
            headers: this.buildHeaders(user),
          },
        ),
      );

      return response.data.data ?? [];
    } catch (error) {
      console.error('Tenant Service request failed:', error);

      throw new ServiceUnavailableException(
        'Unable to retrieve Instructor information.',
      );
    }
  }

  async getInstructorMaterialUploadPolicy(
    user: CurrentUser,
  ): Promise<TenantMaterialUploadPolicy> {
    const baseUrl = this.configService.getOrThrow<string>('TENANT_SERVICE_URL');

    try {
      const response = await firstValueFrom(
        this.httpService.get<TenantApiResponse<TenantMaterialUploadPolicy>>(
          `${baseUrl}/api/v1/subscriptions/internal/instructor-material-upload-policy`,
          {
            headers: this.buildHeaders(user),
          },
        ),
      );

      const policy = response.data.data;

      // Không tin response không hợp lệ.
      if (
        !policy ||
        typeof policy.canUpload !== 'boolean' ||
        typeof policy.maxStorageBytes !== 'string' ||
        !/^\d+$/.test(policy.maxStorageBytes)
      ) {
        throw new Error('Invalid Subscription policy response.');
      }

      return policy;
    } catch (error) {
      console.error(
        'Unable to check Instructor material upload policy:',
        error,
      );

      // Fail closed: lỗi Tenant Service thì không upload.
      throw new ServiceUnavailableException(
        'Unable to verify Subscription upload permission.',
      );
    }
  }
}
