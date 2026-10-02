import { HttpService } from '@nestjs/axios';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CurrentUser } from '@learnup/ts-common';
import { firstValueFrom } from 'rxjs';

import type { TenantApiResponse, TenantInstructor } from './tenant.interface';

@Injectable()
export class TenantClient {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

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
}
