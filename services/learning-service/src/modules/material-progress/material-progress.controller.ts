import type { CurrentUser } from '@learnup/ts-common';
import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { User } from '../../common/decorator/customize';
import { Roles } from '../../common/decorator/roles.decorator';
import { MaterialProgressService } from './material-progress.service';
import { CompleteReadingPipe } from './complete-reading.pipe';
import {
  ReportProgressPipe,
  type ReportProgressDto,
} from './report-progress.dto';

@Controller('enrollments/:enrollmentId/materials/:materialId')
@Roles('LEARNER')
export class MaterialProgressController {
  constructor(private readonly service: MaterialProgressService) {}
  @Get('reading-access')
  readingAccess(
    @User() user: CurrentUser,
    @Param('enrollmentId') enrollmentId: string,
    @Param('materialId') materialId: string,
  ) {
    return this.service.readingAccess(user, enrollmentId, materialId);
  }
  @Post('complete-reading')
  @HttpCode(200)
  completeReading(
    @User() user: CurrentUser,
    @Param('enrollmentId') enrollmentId: string,
    @Param('materialId') materialId: string,
    @Body(CompleteReadingPipe) _body: void,
  ) {
    void _body;
    return this.service.completeReading(user, enrollmentId, materialId);
  }
  @Get('playback')
  playback(
    @User() user: CurrentUser,
    @Param('enrollmentId') enrollmentId: string,
    @Param('materialId') materialId: string,
  ) {
    return this.service.playback(user, enrollmentId, materialId);
  }
  @Post('progress')
  @HttpCode(200)
  progress(
    @User() user: CurrentUser,
    @Param('enrollmentId') enrollmentId: string,
    @Param('materialId') materialId: string,
    @Body(ReportProgressPipe) body: ReportProgressDto,
  ) {
    return this.service.report(user, enrollmentId, materialId, body);
  }
}
