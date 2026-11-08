import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type {
  ResultAssessment,
  ResultAttempt,
  ResultSubmission,
} from './assessment-results';

const toNumber = (value: { toString(): string } | null | undefined) =>
  value === null || value === undefined ? null : Number(value.toString());

/** What one Learner did in one Course, read in three statements. Disabled components are included (BR-296). */
@Injectable()
export class AssessmentResultsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAssessments(
    organizationId: string,
    courseId: string,
  ): Promise<ResultAssessment[]> {
    const rows = await this.prisma.assessment.findMany({
      where: { organizationId, courseId },
      select: {
        id: true,
        kind: true,
        title: true,
        isRequired: true,
        disabledAt: true,
        passingScore: true,
      },
    });
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      isRequired: row.isRequired,
      disabledAt: row.disabledAt,
      passingScore: Number(row.passingScore.toString()),
    }));
  }

  async findAttempts(
    organizationId: string,
    learnerId: string,
    assessmentIds: string[],
  ): Promise<ResultAttempt[]> {
    if (assessmentIds.length === 0) return [];
    const rows = await this.prisma.quizAttempt.findMany({
      where: { organizationId, learnerId, assessmentId: { in: assessmentIds } },
      select: {
        assessmentId: true,
        attemptNumber: true,
        startedAt: true,
        submittedAt: true,
        submissionKind: true,
        score: true,
      },
    });
    return rows.map((row) => ({ ...row, score: toNumber(row.score) }));
  }

  async findSubmissions(
    organizationId: string,
    learnerId: string,
    assessmentIds: string[],
  ): Promise<ResultSubmission[]> {
    if (assessmentIds.length === 0) return [];
    const rows = await this.prisma.submission.findMany({
      where: { organizationId, learnerId, assessmentId: { in: assessmentIds } },
      select: {
        assessmentId: true,
        submissionNumber: true,
        submittedAt: true,
        gradingStatus: true,
        finalScore: true,
        supersededAt: true,
      },
    });
    return rows.map((row) => ({
      ...row,
      finalScore: toNumber(row.finalScore),
    }));
  }
}
