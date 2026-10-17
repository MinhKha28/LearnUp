import { Module } from '@nestjs/common';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { RubricsModule } from '../rubrics/rubrics.module';
import { AssessmentsController } from './assessments.controller';
import { AssessmentsRepository } from './assessments.repository';
import { AssessmentsService } from './assessments.service';
import { AssignmentMediaController } from './assignment-media.controller';
import { AssignmentMediaService } from './assignment-media.service';

@Module({
  imports: [RubricsModule, StorageModule],
  controllers: [AssessmentsController, AssignmentMediaController],
  providers: [
    AssessmentsService,
    AssessmentsRepository,
    AssignmentMediaService,
  ],
  exports: [AssessmentsService, AssessmentsRepository],
})
export class AssessmentsModule {}
