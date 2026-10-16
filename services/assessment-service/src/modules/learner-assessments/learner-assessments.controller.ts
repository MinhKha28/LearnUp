import type { CurrentUser } from '@learnup/ts-common';
import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ResponseMessage, User } from '../../common/decorator/customize';
import { LearnerAssessmentsService } from './learner-assessments.service';

@ApiTags('UC29 - Learner assessments')
@ApiSecurity('internal-key')
@Controller('assessments/learner/courses')
export class LearnerAssessmentsController {
  constructor(private readonly service: LearnerAssessmentsService) {}

  /** UC29 - View the Assessments of an enrolled Course */
  @Get(':courseId/assessments')
  @ResponseMessage('Assessments retrieved successfully.')
  list(
    @User() user: CurrentUser,
    @Param('courseId', ParseUUIDPipe) courseId: string,
  ) {
    return this.service.list(user, courseId);
  }
}
