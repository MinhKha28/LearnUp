import { Module } from '@nestjs/common';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { AdminOrganizationsController } from './admin-organizations.controller';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsRepository } from './organizations.repository';
import { OrganizationsService } from './organizations.service';

@Module({
  imports: [StorageModule, PlatformSettingsModule], // PlatformSettings: ngưỡng cảnh báo usage (UC44.1)
  controllers: [OrganizationsController, AdminOrganizationsController], // UC11, UC44, UC44.1
  providers: [OrganizationsService, OrganizationsRepository],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
