import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

const REVIEW_COMPLETED = 'Completed';
const INSTRUCTOR_REVIEWER_ROLE = 'Instructor';

/** Three yes/no questions about one Learner in one Course (the version); each stops at the first row it finds. */
@Injectable()
export class AssessmentActivityRepository {
  constructor(private readonly prisma: PrismaService) {}

  async hasQuizAttempt(
    organizationId: string,
    learnerId: string,
    courseId: string,
  ): Promise<boolean> {
    const row = await this.prisma.quizAttempt.findFirst({
      where: { organizationId, learnerId, assessment: { courseId } },
      select: { id: true },
    });
    return row !== null;
  }

  async hasSubmission(
    organizationId: string,
    learnerId: string,
    courseId: string,
  ): Promise<boolean> {
    const row = await this.prisma.submission.findFirst({
      where: { organizationId, learnerId, assessment: { courseId } },
      select: { id: true },
    });
    return row !== null;
  }

  async hasPeerReviewGiven(
    organizationId: string,
    learnerId: string,
    courseId: string,
  ): Promise<boolean> {
    const row = await this.prisma.submissionReview.findFirst({
      where: {
        organizationId,
        reviewerId: learnerId,
        status: REVIEW_COMPLETED,
        reviewerRole: { not: INSTRUCTOR_REVIEWER_ROLE, mode: 'insensitive' },
        submission: { assessment: { courseId } },
      },
      select: { id: true },
    });
    return row !== null;
  }
}
