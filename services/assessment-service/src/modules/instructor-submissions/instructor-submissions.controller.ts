import type { CurrentUser } from '@learnup/ts-common';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ResponseMessage, User } from '../../common/decorator/customize';
import { InstructorReviewDto } from './dto/instructor-review.dto';
import { ListSubmissionsQueryDto } from './dto/list-submissions-query.dto';
import { InstructorSubmissionsService } from './instructor-submissions.service';

@ApiTags('UC32 / UC32.1 / UC32.2 - Instructor submissions')
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

  @Post('submissions/:submissionId/instructor-review')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Submission graded successfully.')
  grade(
    @User() user: CurrentUser,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Body() dto: InstructorReviewDto,
  ) {
    return this.service.grade(user, submissionId, dto);
  }
}
