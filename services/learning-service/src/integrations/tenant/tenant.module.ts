import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTenantClient } from './create-tenant-client';
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
  ],
  exports: [TENANT_CLIENT],
})
export class TenantModule {}
