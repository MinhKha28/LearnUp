import { Injectable } from '@nestjs/common';
import {
  buildCompletionSnapshot,
  type CompletionSnapshot,
} from './completion-snapshot';
import { QuizAttemptSettler } from '../quiz-attempts/quiz-attempt-settler';
import { CompletionSnapshotRepository } from './completion-snapshot.repository';

@Injectable()
export class CompletionSnapshotService {
  /** The clock; a test replaces it. */
  clock: () => Date = () => new Date();

  constructor(
    private readonly repository: CompletionSnapshotRepository,
    private readonly quizSettler: QuizAttemptSettler,
  ) {}

  /**
   * What learning-service reads to decide whether the Learner has finished every required Quiz and Assignment of the
   * Course (CT-1). Computed when asked, from the rows; nothing is stored.
   */
  async getSnapshot(
    organizationId: string,
    learnerId: string,
    courseId: string,
  ): Promise<CompletionSnapshot> {
    const now = this.clock();
    // BR-200: a Quiz attempt past its deadline counts with the score of what was saved, so it is submitted before reading
    await this.quizSettler.settleExpired(now, { learnerId, courseId });
    const facts = await this.repository.findFacts(
      organizationId,
      learnerId,
      courseId,
    );
    return buildCompletionSnapshot({
      organizationId,
      learnerId,
      courseId,
      now,
      ...facts,
    });
  }
}
