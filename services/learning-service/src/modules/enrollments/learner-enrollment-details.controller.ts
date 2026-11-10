import type { CurrentUser } from '@learnup/ts-common';
import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ResponseMessage, User } from '../../common/decorator/customize';
import { Roles } from '../../common/decorator/roles.decorator';
import { LearnerEnrollmentDetailsService } from './learner-enrollment-details.service';

@Controller('internal/enrollments')
export class LearnerEnrollmentDetailsController {
  constructor(private readonly service: LearnerEnrollmentDetailsService) {}

  @Get('by-learner/:learnerId')
  @Roles('ORGANIZER')
  @ResponseMessage('Learner enrollments fetched successfully')
  list(
    @User() user: CurrentUser,
    @Param('learnerId', ParseUUIDPipe) learnerId: string,
  ) {
    return this.service.list(user, learnerId.toLowerCase());
  }
}
