import { Module } from '@nestjs/common';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { RegistrationsController } from './registrations.controller';
import { RegistrationsService } from './registrations.service';

@Module({
  imports: [PlatformSettingsModule], // cung cấp PlatformSettingsService cho create() (GĐ2, GĐ4)
  controllers: [RegistrationsController],
  providers: [RegistrationsService],
  exports: [RegistrationsService],
})
export class RegistrationsModule {}
