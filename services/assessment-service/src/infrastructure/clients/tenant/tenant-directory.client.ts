import type { CurrentUser } from '@learnup/ts-common';
import type { IUserDisplayName } from './interfaces/user-display-name.interface';

export const TENANT_BATCH_SIZE = 200;

export abstract class TenantDirectoryClient {
  abstract getDisplayNames(
    user: CurrentUser,
    userIds: string[],
  ): Promise<Map<string, IUserDisplayName>>;
}
