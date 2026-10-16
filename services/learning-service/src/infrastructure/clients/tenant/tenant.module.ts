import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTenantClient } from './create-tenant-client';
import { OrganizationTimezoneService } from './organization-timezone.service';
import { TENANT_CLIENT } from './tenant.client';
import { TenantLookupHttp } from './tenant-lookup.http';

@Module({
  providers: [
    {
      provide: TENANT_CLIENT,
      inject: [ConfigService],
      // Đọc cấu hình lúc khởi động: thiếu hoặc sai thì ứng dụng dừng ngay
      useFactory: (config: ConfigService) => {
        const access = createTenantClient(
          (key) => config.get<string>(key),
          new Logger('TenantClient'),
        );
        const lookup = TenantLookupHttp.fromConfig((key) =>
          config.get<string>(key),
        );
        return {
          getOrganizationAccess: access.getOrganizationAccess.bind(access),
          lookupLearners: lookup.lookupLearners.bind(lookup),
        };
      },
    },
    OrganizationTimezoneService,
  ],
  exports: [TENANT_CLIENT, OrganizationTimezoneService],
})
export class TenantModule {}
