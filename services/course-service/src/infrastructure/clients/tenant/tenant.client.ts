import { HttpService } from '@nestjs/axios';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CurrentUser } from '@learnup/ts-common';
import { firstValueFrom } from 'rxjs';
import { logHttpClientError } from '../log-http-client-error';

import type {
  TenantApiResponse,
  TenantInstructor,
  TenantMaterialUploadPolicy,
  TenantOrganizer,
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

    const path = '/api/v1/users/batch';
    try {
      const response = await firstValueFrom(
        this.httpService.post<TenantApiResponse<TenantInstructor[]>>(
          `${baseUrl}${path}`,
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
      logHttpClientError(error, 'POST', path);

      throw new ServiceUnavailableException(
        'Unable to retrieve Instructor information.',
      );
    }
  }

  async getActiveOrganizer(organizationId: string): Promise<TenantOrganizer> {
    const baseUrl = this.configService.getOrThrow<string>('TENANT_SERVICE_URL');

    const response = await firstValueFrom(
      this.httpService.get<TenantApiResponse<TenantOrganizer>>(
        `${baseUrl}/api/v1/users/internal/organizer`,
        {
          headers: {
            'x-internal-key': this.configService.getOrThrow<string>(
              'INTERNAL_SERVICE_KEY',
            ),
            'x-organization-id': organizationId,
          },
        },
      ),
    );

    const organizer = response.data?.data;

    if (
      !organizer ||
      typeof organizer.id !== 'string' ||
      typeof organizer.email !== 'string' ||
      !organizer.email.trim()
    ) {
      throw new Error('Tenant Service returned invalid Organizer data');
    }

    return organizer;
  }

  async getInstructorMaterialUploadPolicy(
    user: CurrentUser,
  ): Promise<TenantMaterialUploadPolicy> {
    const baseUrl = this.configService.getOrThrow<string>('TENANT_SERVICE_URL');

    const path =
      '/api/v1/subscriptions/internal/instructor-material-upload-policy';
    try {
      const response = await firstValueFrom(
        this.httpService.get<TenantApiResponse<TenantMaterialUploadPolicy>>(
          `${baseUrl}${path}`,
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
      logHttpClientError(error, 'GET', path);

      // Fail closed: lỗi Tenant Service thì không upload.
      throw new ServiceUnavailableException(
        'Unable to verify Subscription upload permission.',
      );
    }
  }
}
