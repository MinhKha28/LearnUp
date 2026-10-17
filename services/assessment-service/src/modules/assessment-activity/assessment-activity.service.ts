import type { CurrentUser } from '@learnup/ts-common';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { AssessmentActivityRepository } from './assessment-activity.repository';
import type { IAssessmentActivity } from './interfaces/assessment-activity.interface';

@Injectable()
export class AssessmentActivityService {
  constructor(private readonly repository: AssessmentActivityRepository) {}

  /**
   * Has the Learner any assessment result in the Course (BR-131)? The Learner in the path is the one the caller
   * speaks for: a different id than the one in the identity headers is refused, so one Learner cannot ask about another.
   */
  async getActivity(
    user: CurrentUser,
    learnerId: string,
    courseId: string,
  ): Promise<IAssessmentActivity> {
    if (user.userId !== learnerId || !user.organizationId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'The Learner does not match the caller.',
      });
    }
    const organizationId = user.organizationId;
    const [hasQuizAttempt, hasSubmission, hasPeerReviewGiven] =
      await Promise.all([
        this.repository.hasQuizAttempt(organizationId, learnerId, courseId),
        this.repository.hasSubmission(organizationId, learnerId, courseId),
        this.repository.hasPeerReviewGiven(organizationId, learnerId, courseId),
      ]);
    return { hasQuizAttempt, hasSubmission, hasPeerReviewGiven };
  }
}
