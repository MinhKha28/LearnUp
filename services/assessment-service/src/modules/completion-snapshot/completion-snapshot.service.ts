import { Injectable } from '@nestjs/common';
import {
  buildCompletionSnapshot,
  type CompletionSnapshot,
} from './completion-snapshot';
import { CompletionSnapshotRepository } from './completion-snapshot.repository';

@Injectable()
export class CompletionSnapshotService {
  /** The clock; a test replaces it. */
  clock: () => Date = () => new Date();

  constructor(private readonly repository: CompletionSnapshotRepository) {}

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
