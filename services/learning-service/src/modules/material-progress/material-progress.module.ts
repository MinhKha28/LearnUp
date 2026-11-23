import { Module } from '@nestjs/common';
import { MaterialProgressController } from './material-progress.controller';
import { MaterialProgressService } from './material-progress.service';
import { CourseServiceModule } from '../../infrastructure/clients/course/course-service.module';
import { MaterialProgressRepository } from './material-progress.repository';
import { ReportProgressPipe } from './report-progress.dto';
import { CompleteReadingPipe } from './complete-reading.pipe';

@Module({
  imports: [CourseServiceModule],
  controllers: [MaterialProgressController],
  providers: [
    MaterialProgressService,
    MaterialProgressRepository,
    ReportProgressPipe,
    CompleteReadingPipe,
  ],
  exports: [MaterialProgressService],
})
export class MaterialProgressModule {}
