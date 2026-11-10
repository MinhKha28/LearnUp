import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CurrentUser } from '@learnup/ts-common';
import { firstValueFrom } from 'rxjs';
import { isAxiosError } from 'axios';
import type {
  TenantApiResponse,
  TenantErrorResponse,
  TenantInstructor,
  TenantMaterialUploadPolicy,
  TenantOrganizer,
  TransferReceiver,
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

  async validateTransferReceiver(
    user: CurrentUser,
    instructorId: string,
  ): Promise<TransferReceiver> {
    const baseUrl = this.configService.getOrThrow<string>('TENANT_SERVICE_URL');

    try {
      const response = await firstValueFrom(
        this.httpService.get<TenantApiResponse<TransferReceiver>>(
          `${baseUrl}/api/v1/users/instructors/` +
            `${encodeURIComponent(instructorId)}/transfer-eligibility`,
          {
            headers: this.buildHeaders(user),
          },
        ),
      );

      const receiver = response.data?.data;

      if (
        !receiver ||
        receiver.id?.toLowerCase() !== instructorId.toLowerCase() ||
        typeof receiver.fullName !== 'string'
      ) {
        throw new Error('Invalid Tenant response');
      }

      return receiver;
    } catch (error: unknown) {
      // Chỉ chuyển 400 INVALID_RECEIVER thành lỗi nghiệp vụ.
      // Các lỗi còn lại không được xem là Instructor không hợp lệ.
      if (
        isAxiosError<TenantErrorResponse>(error) &&
        error.response?.status === 400 &&
        error.response.data?.code === 'INVALID_RECEIVER'
      ) {
        throw new BadRequestException({
          code: 'INVALID_RECEIVER',
          message: 'Receiving Instructor is not eligible.',
        });
      }

      throw new ServiceUnavailableException({
        code: 'TENANT_UNAVAILABLE',
        message: 'Unable to verify receiving Instructor.',
      });
    }
  }
}
