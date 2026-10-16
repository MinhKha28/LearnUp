import { Injectable } from '@nestjs/common';
import type { Prisma } from 'generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export const ASSIGNMENT_KIND = 'ASSIGNMENT';

@Injectable()
export class InstructorSubmissionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: Prisma.TransactionClient) {
    return tx ?? this.prisma;
  }

  findAssignment(
    organizationId: string,
    assessmentId: string,
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).assessment.findFirst({
      where: { id: assessmentId, organizationId, kind: ASSIGNMENT_KIND },
      select: {
        id: true,
        courseId: true,
        title: true,
        peerReviewEnabled: true,
      },
    });
  }

  findSubmissionsOfAssignment(
    assessmentId: string,
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).submission.findMany({
      where: { assessmentId },
      select: {
        id: true,
        learnerId: true,
        submissionNumber: true,
        submittedAt: true,
        gradingStatus: true,
        interventionReason: true,
        finalScore: true,
        reviews: { select: { status: true } },
      },
      orderBy: [{ submittedAt: 'desc' }, { submissionNumber: 'desc' }],
    });
  }

  findSubmissionDetail(
    organizationId: string,
    submissionId: string,
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).submission.findFirst({
      where: { id: submissionId, organizationId },
      include: {
        assessment: {
          include: { rubricCriteria: { orderBy: { position: 'asc' } } },
        },
        reviews: {
          include: { scores: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  findLearnerSubmissions(
    assessmentId: string,
    learnerId: string,
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).submission.findMany({
      where: { assessmentId, learnerId },
      select: {
        id: true,
        submissionNumber: true,
        submittedAt: true,
        gradingStatus: true,
        finalScore: true,
      },
      orderBy: { submissionNumber: 'desc' },
    });
  }
}
