import { Module } from '@nestjs/common';
import { MaterialProgressController } from './material-progress.controller';
import { MaterialProgressService } from './material-progress.service';
import { ConfigService } from '@nestjs/config';
import { CourseServiceModule } from '../../infrastructure/clients/course/course-service.module';
import { MaterialProgressRepository } from './material-progress.repository';
import { ReportProgressPipe } from './report-progress.dto';
import { CompleteReadingPipe } from './complete-reading.pipe';
import {
  READING_ACCESS_CONFIG,
  readReadingAccessConfig,
} from './reading-access.config';
import {
  VIDEO_PLAYBACK_CONFIG,
  readVideoPlaybackConfig,
} from './video-playback.config';

@Module({
  imports: [CourseServiceModule],
  controllers: [MaterialProgressController],
  providers: [
    MaterialProgressService,
    MaterialProgressRepository,
    ReportProgressPipe,
    CompleteReadingPipe,
    {
      provide: READING_ACCESS_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        readReadingAccessConfig((key) => config.get<string>(key)),
    },
    {
      provide: VIDEO_PLAYBACK_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        readVideoPlaybackConfig((key) => config.get<string>(key)),
    },
  ],
  exports: [MaterialProgressService],
})
export class MaterialProgressModule {}
