import { Module } from '@nestjs/common';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    PlatformSettingsModule, // UC12.2: invitation_link_ttl_days
    StorageModule, // UC12.1: avatarUrl
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
