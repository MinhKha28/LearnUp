import { Module } from '@nestjs/common';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { UsersModule } from '../users/users.module';
import { MemberImportsController } from './member-imports.controller';
import { MemberImportsService } from './member-imports.service';

// UC12.8 (Instructor), UC13.8 (Learner): import tài khoản từ Excel. OutboxModule là @Global.
@Module({
  imports: [
    UsersModule, // kiểm tổ chức / số chỗ, thư mời (dùng chung với UC12.2)
    PlatformSettingsModule, // invitation_link_ttl_days (BR-30)
  ],
  controllers: [MemberImportsController],
  providers: [MemberImportsService],
})
export class MemberImportsModule {}
