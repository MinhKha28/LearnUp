import type { CurrentUser } from '@learnup/ts-common';
import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ResponseMessage, User } from '../../common/decorator/customize';
import { AssessmentResultsService } from './assessment-results.service';

@ApiTags('Internal - assessment results (UC28.1)')
@ApiSecurity('internal-key')
@Controller('internal/learners/:learnerId/courses/:courseId')
export class AssessmentResultsController {
  constructor(private readonly service: AssessmentResultsService) {}

  /** For learning-service only (never through the gateway): the scores of the Learner in the Course (UC28.1). */
  @Get('assessment-results')
  @ApiOperation({
    summary:
      'The scores of the Quizzes and Assignments a Learner has done in a Course, with the passing score',
  })
  @ResponseMessage('Assessment results retrieved successfully.')
  getResults(
    @User() user: CurrentUser,
    @Param('learnerId', ParseUUIDPipe) learnerId: string,
    @Param('courseId', ParseUUIDPipe) courseId: string,
  ) {
    return this.service.getResults(user, learnerId, courseId);
  }
}
