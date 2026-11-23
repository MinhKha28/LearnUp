import type { CurrentUser } from '@learnup/ts-common';
import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import {
  ResponseMessage,
  ServiceCall,
  ServiceOrganization,
  User,
} from '../../common/decorator/customize';
import { AssessmentActivityService } from './assessment-activity.service';

@ApiTags('Internal - assessment activity (UC25.4)')
@ApiSecurity('internal-key')
@Controller('internal/learners/:learnerId/courses/:courseId')
export class AssessmentActivityController {
  constructor(private readonly service: AssessmentActivityService) {}

  /** Checks for assessment work before Learning cancels a Required assignment. */
  @ServiceCall()
  @Get('assignment-activity/:organizationId')
  @ResponseMessage('Assignment activity retrieved successfully.')
  getAssignmentActivity(
    @ServiceOrganization() organizationId: string,
    @Param('organizationId', ParseUUIDPipe) pathOrganizationId: string,
    @Param('learnerId', ParseUUIDPipe) learnerId: string,
    @Param('courseId', ParseUUIDPipe) courseId: string,
  ) {
    if (pathOrganizationId.toLowerCase() !== organizationId.toLowerCase())
      throw new NotFoundException('Learner not found.');
    return this.service.getAssignmentActivity(
      organizationId,
      learnerId,
      courseId,
    );
  }

  /**
   * For learning-service only (never through the gateway): did the Learner take a Quiz, submit work or review someone
   * in this Course version? Tells it whether to delete the Enrollment or keep it as Withdrawn (BR-131).
   */
  @Get('assessment-activity')
  @ResponseMessage('Assessment activity retrieved successfully.')
  getActivity(
    @User() user: CurrentUser,
    @Param('learnerId', ParseUUIDPipe) learnerId: string,
    @Param('courseId', ParseUUIDPipe) courseId: string,
  ) {
    return this.service.getActivity(user, learnerId, courseId);
  }
}
