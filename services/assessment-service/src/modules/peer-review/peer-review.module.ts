import { Module } from '@nestjs/common';
import { AssessmentsModule } from '../../assessments/assessments.module';
import { PeerReviewController } from './peer-review.controller';
import { PeerReviewService } from './peer-review.service';

@Module({
  imports: [AssessmentsModule],
  controllers: [PeerReviewController],
  providers: [PeerReviewService],
  exports: [PeerReviewService],
})
export class PeerReviewModule {}
