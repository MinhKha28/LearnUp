import { Module } from '@nestjs/common';
import { AssessmentsModule } from '../assessments/assessments.module';
import { PeerReviewController } from './peer-review.controller';
import { PeerReviewRepository } from './peer-review.repository';
import { PeerReviewSchedule } from './peer-review.schedule';
import { PeerReviewService } from './peer-review.service';

@Module({
  imports: [AssessmentsModule],
  controllers: [PeerReviewController],
  providers: [PeerReviewService, PeerReviewRepository, PeerReviewSchedule],
  exports: [PeerReviewService, PeerReviewSchedule],
})
export class PeerReviewModule {}
