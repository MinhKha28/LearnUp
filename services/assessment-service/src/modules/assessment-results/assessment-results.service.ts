import type { CurrentUser } from '@learnup/ts-common';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { QuizAttemptSettler } from '../quiz-attempts/quiz-attempt-settler';
import { buildAssessmentResults } from './assessment-results';
import { AssessmentResultsRepository } from './assessment-results.repository';
import type { IAssessmentResults } from './interfaces/assessment-results.interface';

@Injectable()
export class AssessmentResultsService {
  /** The clock; a test replaces it. */
  clock: () => Date = () => new Date();

  constructor(
    private readonly repository: AssessmentResultsRepository,
    private readonly settler: QuizAttemptSettler,
  ) {}

  /**
   * UC28.1, for learning-service only (never through the gateway): the scores of the Quizzes and Assignments the Learner
   * has done in the Course, set against the passing score. The Learner in the path must be the one the caller speaks for,
   * so one Learner cannot ask about another. A Quiz attempt that ran out of time is submitted first (BR-200), so its
   * score is there.
   */
  async getResults(
    user: CurrentUser,
    learnerId: string,
    courseId: string,
  ): Promise<IAssessmentResults> {
    if (user.userId !== learnerId || !user.organizationId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'The Learner does not match the caller.',
      });
    }
    const organizationId = user.organizationId;
    await this.settler.settleExpired(this.clock(), { learnerId, courseId });
    const assessments = await this.repository.findAssessments(
      organizationId,
      courseId,
    );
    const ids = assessments.map((a) => a.id);
    const [attempts, submissions] = await Promise.all([
      this.repository.findAttempts(organizationId, learnerId, ids),
      this.repository.findSubmissions(organizationId, learnerId, ids),
    ]);
    return {
      courseId,
      items: buildAssessmentResults(assessments, attempts, submissions),
    };
  }
}
