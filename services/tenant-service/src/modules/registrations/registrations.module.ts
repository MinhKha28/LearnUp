import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { RegistrationsController } from './registrations.controller';
import { RegistrationsService } from './registrations.service';
import { RegistrationsRepository } from './registrations.repository';

@Module({
  imports: [PlatformSettingsModule, PaymentsModule],
  controllers: [RegistrationsController],
  providers: [RegistrationsService, RegistrationsRepository],
  exports: [RegistrationsService],
})
export class RegistrationsModule {}
