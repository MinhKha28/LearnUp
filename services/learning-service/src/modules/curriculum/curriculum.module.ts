import { Module } from '@nestjs/common';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { CourseServiceModule } from '../../infrastructure/clients/course/course-service.module';
import { TenantModule } from '../../infrastructure/clients/tenant/tenant.module';
import { CurriculumController } from './curriculum.controller';
import { CurriculumRepository } from './curriculum.repository';
import { CurriculumService } from './curriculum.service';

@Module({
  imports: [EnrollmentsModule, CourseServiceModule, TenantModule],
  controllers: [CurriculumController],
  providers: [CurriculumService, CurriculumRepository],
})
export class CurriculumModule {}
