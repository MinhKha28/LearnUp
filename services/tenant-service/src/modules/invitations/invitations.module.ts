import { Module } from '@nestjs/common';
import { AccountTokensModule } from '../account-tokens/account-tokens.module';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';

@Module({
  imports: [AccountTokensModule], // findUsable / consume liên kết mời
  controllers: [InvitationsController],
  providers: [InvitationsService],
})
export class InvitationsModule {}
