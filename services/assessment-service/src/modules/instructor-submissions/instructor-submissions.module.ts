import { Module } from '@nestjs/common';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { InstructorSubmissionsController } from './instructor-submissions.controller';
import { InstructorSubmissionsRepository } from './instructor-submissions.repository';
import { InstructorSubmissionsService } from './instructor-submissions.service';

@Module({
  imports: [StorageModule],
  controllers: [InstructorSubmissionsController],
  providers: [InstructorSubmissionsService, InstructorSubmissionsRepository],
})
export class InstructorSubmissionsModule {}
