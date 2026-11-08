import { Module } from '@nestjs/common';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { LearnerReviewsController } from './learner-reviews.controller';
import { LearnerReviewsRepository } from './learner-reviews.repository';
import { LearnerReviewsService } from './learner-reviews.service';

@Module({
  imports: [StorageModule],
  controllers: [LearnerReviewsController],
  providers: [LearnerReviewsService, LearnerReviewsRepository],
})
export class LearnerReviewsModule {}
