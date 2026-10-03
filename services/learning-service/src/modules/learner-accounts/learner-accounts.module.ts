import { Module } from '@nestjs/common';
import { LearnerAccountsController } from './learner-accounts.controller';
import { LearnerAccountsService } from './learner-accounts.service';

@Module({
  controllers: [LearnerAccountsController],
  providers: [LearnerAccountsService],
  exports: [LearnerAccountsService],
})
export class LearnerAccountsModule {}
