import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTenantClient } from './create-tenant-client';
import { OrganizationTimezoneService } from './organization-timezone.service';
import { TENANT_CLIENT } from './tenant.client';

@Module({
  providers: [
    {
      provide: TENANT_CLIENT,
      inject: [ConfigService],
      // Đọc cấu hình lúc khởi động: thiếu hoặc sai thì ứng dụng dừng ngay
      useFactory: (config: ConfigService) =>
        createTenantClient(
          (key) => config.get<string>(key),
          new Logger('TenantClient'),
        ),
    },
    OrganizationTimezoneService,
  ],
  exports: [TENANT_CLIENT, OrganizationTimezoneService],
})
export class TenantModule {}
