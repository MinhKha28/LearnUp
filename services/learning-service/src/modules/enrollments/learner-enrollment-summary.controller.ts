import type { CurrentUser } from '@learnup/ts-common';
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ResponseMessage, User } from '../../common/decorator/customize';
import { LearnerEnrollmentSummaryDto } from './dto/learner-enrollment-summary.dto';
import { LearnerEnrollmentSummaryService } from './learner-enrollment-summary.service';

@Controller('internal/enrollments')
export class LearnerEnrollmentSummaryController {
  constructor(private readonly service: LearnerEnrollmentSummaryService) {}

  @Post('summary-by-learners')
  @HttpCode(200)
  @ResponseMessage('Learner enrollment summaries fetched successfully')
  summarize(
    @User() user: CurrentUser,
    @Body() dto: LearnerEnrollmentSummaryDto,
  ) {
    return this.service.summarize(user.organizationId!, dto.learnerIds);
  }
}
