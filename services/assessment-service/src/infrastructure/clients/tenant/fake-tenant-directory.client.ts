import { Logger } from '@nestjs/common';
import type { IUserDisplayName } from './interfaces/user-display-name.interface';
import { TenantDirectoryClient } from './tenant-directory.client';

export class FakeTenantDirectoryClient extends TenantDirectoryClient {
  private readonly logger = new Logger(FakeTenantDirectoryClient.name);

  constructor() {
    super();
    this.logger.warn(
      '[FAKE] TENANT_CLIENT_MODE=fake: learner names are generated, tenant-service is not called.',
    );
  }

  getDisplayNames(
    _user: unknown,
    userIds: string[],
  ): Promise<Map<string, IUserDisplayName>> {
    const names = new Map<string, IUserDisplayName>();
    for (const id of new Set(userIds)) {
      const suffix = id.slice(-4).toUpperCase();
      names.set(id, {
        id,
        fullName: `Learner ${suffix}`,
        email: `learner.${suffix.toLowerCase()}@demo.local`,
        role: 'Learner',
        status: 'Active',
      });
    }
    return Promise.resolve(names);
  }
}
