import { Module } from '@nestjs/common';
import { AssessmentActivityController } from './assessment-activity.controller';
import { AssessmentActivityRepository } from './assessment-activity.repository';
import { AssessmentActivityService } from './assessment-activity.service';

@Module({
  controllers: [AssessmentActivityController],
  providers: [AssessmentActivityService, AssessmentActivityRepository],
})
export class AssessmentActivityModule {}
