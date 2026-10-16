import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class LearnerAssessmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Quizzes and Assignments of the Course that are not Disabled, in the order of one place (BR-291). */
  findAssessments(organizationId: string, courseId: string) {
    return this.prisma.assessment.findMany({
      where: { organizationId, courseId, disabledAt: null },
      orderBy: [
        { moduleId: { sort: 'asc', nulls: 'last' } },
        { position: 'asc' },
        { id: 'asc' },
      ],
      select: {
        id: true,
        kind: true,
        title: true,
        moduleId: true,
        position: true,
        isRequired: true,
        passingScore: true,
        maxConsecutiveAttempts: true,
        lockoutHours: true,
        timeLimitMinutes: true,
        expectedDurationMinutes: true,
      },
    });
  }

  findStates(learnerId: string, assessmentIds: string[]) {
    return this.prisma.learnerAssessmentState.findMany({
      where: { learnerId, assessmentId: { in: assessmentIds } },
    });
  }

  findQuizAttempts(learnerId: string, assessmentIds: string[]) {
    return this.prisma.quizAttempt.findMany({
      where: { learnerId, assessmentId: { in: assessmentIds } },
      select: { assessmentId: true, submittedAt: true, score: true },
    });
  }

  /** The submission that counts for each Assignment: the newest one that was not replaced (BR-170). */
  findLatestSubmissions(learnerId: string, assessmentIds: string[]) {
    return this.prisma.submission.findMany({
      where: {
        learnerId,
        assessmentId: { in: assessmentIds },
        supersededAt: null,
      },
      orderBy: { submissionNumber: 'asc' },
      select: {
        assessmentId: true,
        submittedAt: true,
        gradingStatus: true,
        finalScore: true,
      },
    });
  }

  async isEnrollmentCompleted(enrollmentId: string): Promise<boolean> {
    const row = await this.prisma.completedEnrollment.findUnique({
      where: { enrollmentId },
      select: { enrollmentId: true },
    });
    return row !== null;
  }
}
