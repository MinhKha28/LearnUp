import { Module } from '@nestjs/common';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { LearnerSubmissionsController } from './learner-submissions.controller';
import { LearnerSubmissionsRepository } from './learner-submissions.repository';
import { LearnerSubmissionsService } from './learner-submissions.service';

@Module({
  imports: [StorageModule],
  controllers: [LearnerSubmissionsController],
  providers: [LearnerSubmissionsService, LearnerSubmissionsRepository],
})
export class LearnerSubmissionsModule {}
