import { Module } from '@nestjs/common';
import { RubricsModule } from '../rubrics/rubrics.module';
import { AssessmentsController } from './assessments.controller';
import { AssessmentsService } from './assessments.service';
import { CourseClient } from './course.client';

@Module({
  imports: [RubricsModule],
  controllers: [AssessmentsController],
  providers: [AssessmentsService, CourseClient],
  exports: [AssessmentsService],
})
export class AssessmentsModule {}
