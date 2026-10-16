import type { CurrentUser } from '@learnup/ts-common';
import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ResponseMessage, User } from '../../common/decorator/customize';
import { ListSubmissionsQueryDto } from './dto/list-submissions-query.dto';
import { InstructorSubmissionsService } from './instructor-submissions.service';

@ApiTags('UC32 / UC32.1 - Instructor submissions')
@ApiSecurity('internal-key')
@Controller('assessments')
export class InstructorSubmissionsController {
  constructor(private readonly service: InstructorSubmissionsService) {}

  @Get('assignments/:assessmentId/submissions')
  @ResponseMessage('Submissions retrieved successfully.')
  list(
    @User() user: CurrentUser,
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
    @Query() query: ListSubmissionsQueryDto,
  ) {
    return this.service.list(user, assessmentId, query);
  }

  @Get('submissions/:submissionId')
  @ResponseMessage('Submission retrieved successfully.')
  detail(
    @User() user: CurrentUser,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
  ) {
    return this.service.detail(user, submissionId);
  }
}
