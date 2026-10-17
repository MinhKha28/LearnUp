import { Module } from '@nestjs/common';
import { AccountTokensController } from './account-tokens.controller';
import { AccountTokensService } from './account-tokens.service';
import { AccountTokensRepository } from './account-tokens.repository';

@Module({
  controllers: [AccountTokensController],
  providers: [AccountTokensService, AccountTokensRepository],
  exports: [AccountTokensService],
})
export class AccountTokensModule {}
