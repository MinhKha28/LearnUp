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

  transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(work);
  }

  findSubmissionCourse(
    organizationId: string,
    submissionId: string,
    tx?: Prisma.TransactionClient,
  ) {
    return this.db(tx).submission.findFirst({
      where: { id: submissionId, organizationId },
      select: { assessment: { select: { kind: true, courseId: true } } },
    });
  }

  async lockSubmission(tx: Prisma.TransactionClient, submissionId: string) {
    await tx.$queryRaw`SELECT id FROM submissions WHERE id = ${submissionId}::uuid FOR UPDATE`;
  }

  findSubmissionForGrading(
    tx: Prisma.TransactionClient,
    organizationId: string,
    submissionId: string,
  ) {
    return tx.submission.findFirst({
      where: { id: submissionId, organizationId },
      include: {
        assessment: {
          select: {
            kind: true,
            rubricCriteria: { select: { id: true, maxPoints: true } },
          },
        },
        reviews: { select: { status: true, score: true } },
      },
    });
  }

  async findLatestSubmissionNumber(
    tx: Prisma.TransactionClient,
    assessmentId: string,
    learnerId: string,
  ) {
    const result = await tx.submission.aggregate({
      where: { assessmentId, learnerId },
      _max: { submissionNumber: true },
    });
    return result._max.submissionNumber;
  }

  createReview(
    tx: Prisma.TransactionClient,
    data: Prisma.SubmissionReviewUncheckedCreateInput,
  ) {
    return tx.submissionReview.create({
      data,
      include: { scores: { select: { criterionId: true, points: true } } },
    });
  }

  async moveStatus(
    tx: Prisma.TransactionClient,
    submissionId: string,
    from: string,
    to: string,
  ) {
    const result = await tx.submission.updateMany({
      where: { id: submissionId, gradingStatus: from },
      data: { gradingStatus: to },
    });
    return result.count;
  }
}
