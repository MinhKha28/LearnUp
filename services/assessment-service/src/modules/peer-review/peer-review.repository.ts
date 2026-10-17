import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { assignmentInclude } from '../assessments/assessments.repository';
import type { PeerReviewUpdateData } from './interfaces/peer-review-update-data.interface';

/** Database access of UC19.5; the Peer Review settings live on the Assignment row. */
@Injectable()
export class PeerReviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  updateConfig(assignmentId: string, data: PeerReviewUpdateData) {
    return this.prisma.assessment.update({
      where: { id: assignmentId },
      data,
      include: assignmentInclude,
    });
  }

  /** UC33: the cycles of an Assignment, oldest first. */
  findCycles(assessmentId: string) {
    return this.prisma.peerReviewCycle.findMany({
      where: { assessmentId },
      orderBy: { opensAt: 'asc' },
    });
  }

  /** UC33: the submissions in each cycle, one per Learner: a replaced submission is not counted (BR-171). */
  async countSubmissionsByCycle(
    cycleIds: string[],
  ): Promise<Map<string, number>> {
    const rows = await this.prisma.submission.groupBy({
      by: ['cycleId'],
      where: { cycleId: { in: cycleIds }, supersededAt: null },
      _count: { _all: true },
    });
    const counts = new Map<string, number>();
    for (const row of rows) {
      if (row.cycleId) counts.set(row.cycleId, row._count._all);
    }
    return counts;
  }
}
