import { Injectable } from '@nestjs/common';
import { LearnerEnrollmentSummaryRepository } from './learner-enrollment-summary.repository';

@Injectable()
export class LearnerEnrollmentSummaryService {
  constructor(
    private readonly repository: LearnerEnrollmentSummaryRepository,
  ) {}

  async summarize(organizationId: string, learnerIds: string[]) {
    const summaries: Record<
      string,
      { activeCourseCount: number; overdueCourseCount: number }
    > = Object.fromEntries(
      learnerIds.map((id) => [
        id,
        { activeCourseCount: 0, overdueCourseCount: 0 },
      ]),
    );
    const rows = await this.repository.summarize(organizationId, learnerIds);
    const requestedIds = new Map(
      learnerIds.map((id) => [id.toLowerCase(), id]),
    );
    for (const { learnerId, activeCourseCount, overdueCourseCount } of rows) {
      summaries[requestedIds.get(learnerId)!] = {
        activeCourseCount,
        overdueCourseCount,
      };
    }
    return { summaries };
  }
}
