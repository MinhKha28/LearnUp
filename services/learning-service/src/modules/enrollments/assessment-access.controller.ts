import { Controller, Get, Query } from '@nestjs/common';
import type { CurrentUser } from '@learnup/ts-common';
import { User } from '../../common/decorator/customize';
import { AssessmentAccessService } from './assessment-access.service';
import {
  AssessmentAccessQueryPipe,
  type AssessmentAccessQuery,
} from './assessment-access.query';

@Controller('internal/enrollments')
export class AssessmentAccessController {
  constructor(private readonly service: AssessmentAccessService) {}
  @Get('assessment-access')
  get(
    @User() user: CurrentUser,
    @Query(AssessmentAccessQueryPipe) query: AssessmentAccessQuery,
  ) {
    return this.service.get(
      query.learnerId,
      query.courseId,
      user.organizationId!,
    );
  }
}
