import { CompletionModule } from '../course-completion/completion.module';
import { ProgressService } from './progress.service';
import { AssessmentResultsService } from './assessment-results.service';
import { AssessmentModule } from '../../infrastructure/clients/assessment/assessment.module';
import { Module } from '@nestjs/common';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { CourseServiceModule } from '../../infrastructure/clients/course/course-service.module';
import { TenantModule } from '../../infrastructure/clients/tenant/tenant.module';
import { CurriculumController } from './curriculum.controller';
import { CurriculumRepository } from './curriculum.repository';
import { CurriculumService } from './curriculum.service';

@Module({
  imports: [
    CompletionModule,
    AssessmentModule,
    EnrollmentsModule,
    CourseServiceModule,
    TenantModule,
  ],
  controllers: [CurriculumController],
  providers: [
    ProgressService,
    AssessmentResultsService,
    CurriculumService,
    CurriculumRepository,
  ],
})
export class CurriculumModule {}
