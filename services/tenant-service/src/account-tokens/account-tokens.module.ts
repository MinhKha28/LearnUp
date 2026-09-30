import { Module } from '@nestjs/common';
import { AccountTokensController } from './account-tokens.controller';
import { AccountTokensService } from './account-tokens.service';

@Module({
  controllers: [AccountTokensController],
  providers: [AccountTokensService],
  exports: [AccountTokensService],
})
export class AccountTokensModule {}
