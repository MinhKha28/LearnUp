import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ApiResponse, CurrentUser } from '@learnup/ts-common';
import { HEADER_NAMES } from '@learnup/ts-common';
import type { IUserDisplayName } from './interfaces/user-display-name.interface';
import {
  TENANT_BATCH_SIZE,
  TenantDirectoryClient,
} from './tenant-directory.client';

const DEFAULT_TIMEOUT_MS = 5000;

export class HttpTenantDirectoryClient extends TenantDirectoryClient {
  private readonly logger = new Logger(HttpTenantDirectoryClient.name);
  private readonly baseUrl: string;
  private readonly internalKey: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    super();
    this.baseUrl =
      config.get<string>('TENANT_SERVICE_URL') ?? 'http://localhost:8084';
    this.internalKey = config.getOrThrow<string>('INTERNAL_SERVICE_KEY');
    this.timeoutMs =
      Number(config.get<string>('TENANT_SERVICE_TIMEOUT_MS')) ||
      DEFAULT_TIMEOUT_MS;
  }

  async getDisplayNames(
    user: CurrentUser,
    userIds: string[],
  ): Promise<Map<string, IUserDisplayName>> {
    const unique = [...new Set(userIds)];
    const names = new Map<string, IUserDisplayName>();
    for (let start = 0; start < unique.length; start += TENANT_BATCH_SIZE) {
      const batch = unique.slice(start, start + TENANT_BATCH_SIZE);
      for (const item of await this.fetchBatch(user, batch)) {
        names.set(item.id, item);
      }
    }
    return names;
  }

  private async fetchBatch(
    user: CurrentUser,
    userIds: string[],
  ): Promise<IUserDisplayName[]> {
    let response: Response;
    try {
      response = await fetch(
        `${this.baseUrl}/api/v1/internal/users/display-names`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            [HEADER_NAMES.INTERNAL_KEY]: this.internalKey,
            [HEADER_NAMES.USER_ID]: user.userId,
            [HEADER_NAMES.ORGANIZATION_ID]: user.organizationId ?? '',
            [HEADER_NAMES.USER_ROLE]: user.role,
          },
          body: JSON.stringify({ userIds }),
          signal: AbortSignal.timeout(this.timeoutMs),
        },
      );
    } catch (error) {
      this.logger.warn(
        `Cannot reach tenant-service (${this.baseUrl}): ${(error as Error).message}`,
      );
      throw new ServiceUnavailableException({
        code: 'TENANT_SERVICE_UNAVAILABLE',
        message: 'Tenant Service is unavailable. Please try again later.',
      });
    }
    if (!response.ok) {
      this.logger.warn(`tenant-service returned HTTP ${response.status}.`);
      throw new ServiceUnavailableException({
        code: 'TENANT_SERVICE_UNAVAILABLE',
        message: `Tenant Service returned HTTP ${response.status}.`,
      });
    }
    const body = (await response.json()) as ApiResponse<IUserDisplayName[]>;
    return Array.isArray(body.data) ? body.data : [];
  }
}
