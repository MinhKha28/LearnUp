import { ConflictException, Injectable } from '@nestjs/common';
import type { CurrentUser } from '@learnup/ts-common';

import {
  AssessmentsService,
  AUTHORABLE_STATUSES,
  assignmentInclude,
} from '../assessments/assessments.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { cycleStatusOf } from './cycle-status';
import type { IPeerReviewCycleList } from './interfaces/peer-review-cycle.interface';
import { UpdatePeerReviewDto } from './dto/update-peer-review.dto';
import { Prisma } from 'generated/prisma/browser';

@Injectable()
export class PeerReviewService {
  /** The clock of the status of a cycle; a test replaces it to travel in time. */
  clock: () => Date = () => new Date();

  constructor(
    private readonly prisma: PrismaService,
    private readonly assessments: AssessmentsService,
  ) {}

  /** UC33 — the cycles of an Assignment of the Instructor in charge, oldest first (BR-200). */
  async listCycles(
    user: CurrentUser,
    assignmentId: string,
  ): Promise<IPeerReviewCycleList> {
    const { assignment } = await this.assessments.findOwnAssignment(
      user,
      assignmentId,
    );
    // PRE-1
    if (!assignment.peerReviewEnabled) {
      throw new ConflictException({
        code: 'PEER_REVIEW_NOT_ENABLED',
        message: 'Peer Review is not enabled for this Assignment.',
      });
    }

    const cycles = await this.prisma.peerReviewCycle.findMany({
      where: { assessmentId: assignment.id },
      orderBy: { opensAt: 'asc' },
    });
    const counts = await this.prisma.submission.groupBy({
      by: ['cycleId'],
      where: {
        cycleId: { in: cycles.map((cycle) => cycle.id) },
        supersededAt: null,
      },
      _count: { _all: true },
    });
    const countOf = new Map(
      counts.map((row) => [row.cycleId, row._count._all]),
    );

    const now = this.clock();
    return {
      assignmentId: assignment.id,
      title: assignment.title,
      settings: {
        reviewersPerSubmission: assignment.peerReviewersPerSubmission,
        cycleDays: assignment.peerReviewCycleDays,
        deadlineDays: assignment.peerReviewDeadlineDays,
        scoreGap:
          assignment.peerReviewScoreGap === null
            ? null
            : Number(assignment.peerReviewScoreGap.toString()),
      },
      items: cycles.map((cycle) => {
        const submissionCount = countOf.get(cycle.id) ?? 0;
        return {
          id: cycle.id,
          opensAt: cycle.opensAt.toISOString(),
          closesAt: cycle.closesAt.toISOString(),
          reviewDueAt: cycle.reviewDueAt.toISOString(),
          submissionCount,
          status: cycleStatusOf({
            stored: cycle.status,
            closesAt: cycle.closesAt,
            reviewersPerSubmission: cycle.reviewersPerSubmission,
            submissionCount,
            now,
          }),
        };
      }),
    };
  }

  /** UC19.5 — turn peer review on/off and configure its cycle (BR-182, BR-183). */
  async updateConfig(
    user: CurrentUser,
    assignmentId: string,
    dto: UpdatePeerReviewDto,
  ) {
    const { assignment, course } = await this.assessments.findOwnAssignment(
      user,
      assignmentId,
    );

    if (
      course.disabled ||
      !AUTHORABLE_STATUSES.includes(course.status.toUpperCase())
    ) {
      throw new ConflictException({
        code: 'COURSE_NOT_EDITABLE',
        message: `Peer Review cannot be changed while the Course is ${course.status}.`,
      });
    }
    // BR-185 / BR-93: only the on/off switch is blocked by Locked; the parameters stay editable.
    if (course.locked && dto.enabled !== assignment.peerReviewEnabled) {
      throw new ConflictException({
        code: 'PEER_REVIEW_TOGGLE_LOCKED',
        message:
          'Peer Review cannot be turned on or off because the Course is Locked. Create a new Course version to change it.',
      });
    }

    let data: Prisma.AssessmentUpdateInput = { peerReviewEnabled: dto.enabled };
    if (dto.enabled) {
      const settings = await this.prisma.platformSetting.findFirst({
        orderBy: { createdAt: 'desc' },
      });
      data = {
        peerReviewEnabled: true,
        peerReviewersPerSubmission: dto.reviewersPerSubmission,
        peerReviewCycleDays:
          dto.cycleDays ??
          assignment.peerReviewCycleDays ??
          settings?.defaultPeerReviewCycleDays ??
          7,
        peerReviewDeadlineDays:
          dto.deadlineDays ??
          assignment.peerReviewDeadlineDays ??
          settings?.defaultPeerReviewDeadlineDays ??
          3,
        peerReviewScoreGap: dto.scoreGap,
      };
    }

    // BR-269: new values apply only to cycles created afterwards; existing cycles keep their dates.
    const updated = await this.prisma.assessment.update({
      where: { id: assignment.id },
      data,
      include: assignmentInclude,
    });
    return this.assessments.toDetail(updated, course.locked);
  }
}
