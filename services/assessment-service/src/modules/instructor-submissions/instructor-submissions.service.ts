import type { CurrentUser } from '@learnup/ts-common';
import type { IStorageProvider } from '@learnup/ts-storage';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CourseServiceClient } from '../../infrastructure/clients/course/course-service.client';
import type { IUserDisplayName } from '../../infrastructure/clients/tenant/interfaces/user-display-name.interface';
import { TenantDirectoryClient } from '../../infrastructure/clients/tenant/tenant-directory.client';
import { STORAGE_PROVIDER } from '../../infrastructure/storage/storage.constants';
import { InstructorReviewDto } from './dto/instructor-review.dto';
import { ListSubmissionsQueryDto } from './dto/list-submissions-query.dto';
import type { IInstructorReviewResult } from './interfaces/instructor-review-result.interface';
import {
  IAttachedFile,
  ILearnerSummary,
  ISubmissionDetail,
  ISubmissionList,
  ISubmissionListItem,
} from './interfaces/instructor-submission.interface';
import {
  ASSIGNMENT_KIND,
  InstructorSubmissionsRepository,
} from './instructor-submissions.repository';
import {
  AWAITING_FINALIZATION,
  AWAITING_INSTRUCTOR,
  INSTRUCTOR_REVIEWER_ROLE,
  REVIEW_COMPLETED,
} from './instructor-submissions.constants';

const roundScore = (value: number) => Math.round(value * 100) / 100;

const toNumber = (value: { toString(): string } | null | undefined) =>
  value === null || value === undefined ? null : Number(value.toString());

@Injectable()
export class InstructorSubmissionsService {
  private readonly logger = new Logger(InstructorSubmissionsService.name);

  constructor(
    private readonly repository: InstructorSubmissionsRepository,
    private readonly courses: CourseServiceClient,
    private readonly tenant: TenantDirectoryClient,
    @Inject(STORAGE_PROVIDER) private readonly storage: IStorageProvider,
  ) {}

  async list(
    user: CurrentUser,
    assessmentId: string,
    query: ListSubmissionsQueryDto,
  ): Promise<ISubmissionList> {
    const organizationId = this.requireInstructor(user);
    const assignment = await this.repository.findAssignment(
      organizationId,
      assessmentId,
    );
    if (!assignment) throw this.assignmentNotFound();
    await this.requireOwnCourse(user, assignment.courseId);

    const rows = await this.repository.findSubmissionsOfAssignment(
      assignment.id,
    );
    const latestNumber = new Map<string, number>();
    for (const row of rows) {
      latestNumber.set(
        row.learnerId,
        Math.max(latestNumber.get(row.learnerId) ?? 0, row.submissionNumber),
      );
    }
    const isLatest = (row: { learnerId: string; submissionNumber: number }) =>
      latestNumber.get(row.learnerId) === row.submissionNumber;

    const visible = rows.filter((row) => !query.latestOnly || isLatest(row));
    const statusCounts: Record<string, number> = {};
    for (const row of visible) {
      statusCounts[row.gradingStatus] =
        (statusCounts[row.gradingStatus] ?? 0) + 1;
    }

    const names = await this.loadNames(
      user,
      visible.map((row) => row.learnerId),
    );
    const keyword = query.q?.toLowerCase();
    const filtered = visible.filter((row) => {
      if (query.status && row.gradingStatus !== query.status) return false;
      if (!keyword) return true;
      const learner = names.map?.get(row.learnerId);
      return [learner?.fullName, learner?.email]
        .filter(Boolean)
        .some((text) => text!.toLowerCase().includes(keyword));
    });

    const start = (query.page - 1) * query.pageSize;
    const items: ISubmissionListItem[] = filtered
      .slice(start, start + query.pageSize)
      .map((row) => ({
        id: row.id,
        learner: this.learnerOf(row.learnerId, names.map),
        submissionNumber: row.submissionNumber,
        submittedAt: row.submittedAt,
        isLatest: isLatest(row),
        gradingStatus: row.gradingStatus,
        interventionReason: row.interventionReason,
        finalScore: toNumber(row.finalScore),
        reviews: {
          completed: row.reviews.filter((r) => r.status === REVIEW_COMPLETED)
            .length,
          total: row.reviews.length,
        },
      }));

    return {
      assignment,
      statusCounts,
      learnerNamesAvailable: names.map !== null,
      items,
      page: query.page,
      pageSize: query.pageSize,
      total: filtered.length,
    };
  }

  async detail(
    user: CurrentUser,
    submissionId: string,
  ): Promise<ISubmissionDetail> {
    const organizationId = this.requireInstructor(user);
    const submission = await this.repository.findSubmissionDetail(
      organizationId,
      submissionId,
    );
    if (!submission || submission.assessment.kind !== ASSIGNMENT_KIND) {
      throw new NotFoundException({
        code: 'SUBMISSION_NOT_FOUND',
        message: 'Submission not found.',
      });
    }
    const assignment = submission.assessment;
    await this.requireOwnCourse(user, assignment.courseId);

    const history = await this.repository.findLearnerSubmissions(
      assignment.id,
      submission.learnerId,
    );
    const names = await this.loadNames(user, [
      submission.learnerId,
      ...submission.reviews.map((review) => review.reviewerId),
    ]);

    return {
      id: submission.id,
      learner: this.learnerOf(submission.learnerId, names.map),
      submissionNumber: submission.submissionNumber,
      submittedAt: submission.submittedAt,
      isLatest: history[0]?.id === submission.id,
      content: submission.content,
      file: this.fileOf(
        submission.fileKey,
        submission.fileName,
        submission.fileMime,
        submission.fileSizeBytes,
      ),
      gradingStatus: submission.gradingStatus,
      interventionReason: submission.interventionReason,
      finalScore: toNumber(submission.finalScore),
      finalizationComment: submission.finalizationComment,
      finalizedAt: submission.finalizedAt,
      assignment: {
        id: assignment.id,
        courseId: assignment.courseId,
        title: assignment.title,
        prompt: assignment.prompt,
        promptFile: this.fileOf(
          assignment.promptFileKey,
          assignment.promptFileName,
          assignment.promptFileMime,
          assignment.promptFileSizeBytes,
        ),
        passingScore: Number(assignment.passingScore),
        peerReviewEnabled: assignment.peerReviewEnabled,
        rubric: assignment.rubricCriteria.map((criterion) => ({
          id: criterion.id,
          name: criterion.name,
          description: criterion.description,
          maxPoints: criterion.maxPoints,
          position: criterion.position,
        })),
      },
      reviews: submission.reviews.map((review) => ({
        id: review.id,
        reviewer: this.learnerOf(review.reviewerId, names.map),
        reviewerRole: review.reviewerRole,
        status: review.status,
        score: toNumber(review.score),
        comment: review.comment,
        completedAt: review.completedAt,
        scores: review.scores.map((score) => ({
          criterionId: score.criterionId,
          points: score.points,
        })),
      })),
      history: history.map((item) => ({
        id: item.id,
        submissionNumber: item.submissionNumber,
        submittedAt: item.submittedAt,
        gradingStatus: item.gradingStatus,
        finalScore: toNumber(item.finalScore),
      })),
    };
  }

  async grade(
    user: CurrentUser,
    submissionId: string,
    dto: InstructorReviewDto,
  ): Promise<IInstructorReviewResult> {
    const organizationId = this.requireInstructor(user);
    const target = await this.repository.findSubmissionCourse(
      organizationId,
      submissionId,
    );
    if (!target || target.assessment.kind !== ASSIGNMENT_KIND) {
      throw this.submissionNotFound();
    }
    await this.requireOwnCourse(user, target.assessment.courseId);

    return this.repository.transaction(async (tx) => {
      await this.repository.lockSubmission(tx, submissionId);
      const submission = await this.repository.findSubmissionForGrading(
        tx,
        organizationId,
        submissionId,
      );
      if (!submission) throw this.submissionNotFound();

      const latestNumber = await this.repository.findLatestSubmissionNumber(
        tx,
        submission.assessmentId,
        submission.learnerId,
      );
      if (
        submission.gradingStatus !== AWAITING_INSTRUCTOR ||
        latestNumber !== submission.submissionNumber
      ) {
        throw this.notAwaitingInstructor();
      }

      const score = this.scoreFromRubric(
        submission.assessment.rubricCriteria,
        dto.scores,
      );
      const completedAt = new Date();

      const review = await this.repository.createReview(tx, {
        organizationId,
        submissionId: submission.id,
        cycleId: submission.cycleId,
        reviewerId: user.userId,
        reviewerRole: INSTRUCTOR_REVIEWER_ROLE,
        status: REVIEW_COMPLETED,
        score,
        comment: dto.comment,
        completedAt,
        scores: {
          create: dto.scores.map((item) => ({
            organizationId,
            criterionId: item.criterionId,
            points: item.points,
          })),
        },
      });

      const moved = await this.repository.moveStatus(
        tx,
        submission.id,
        AWAITING_INSTRUCTOR,
        AWAITING_FINALIZATION,
      );
      if (moved === 0) throw this.notAwaitingInstructor();

      const validScores = [
        ...submission.reviews
          .filter(
            (item) => item.status === REVIEW_COMPLETED && item.score !== null,
          )
          .map((item) => Number(item.score)),
        score,
      ];
      const suggestedScore = roundScore(
        validScores.reduce((sum, value) => sum + value, 0) / validScores.length,
      );

      return {
        submissionId: submission.id,
        gradingStatus: AWAITING_FINALIZATION,
        review: {
          id: review.id,
          score,
          comment: review.comment,
          completedAt,
          scores: review.scores,
        },
        validReviewCount: validScores.length,
        suggestedScore,
      };
    });
  }

  private scoreFromRubric(
    rubric: { id: string; maxPoints: number }[],
    scores: { criterionId: string; points: number }[],
  ): number {
    if (rubric.length === 0) {
      throw new BadRequestException({
        code: 'RUBRIC_MISSING',
        message: 'This Assignment has no Rubric criteria to grade against.',
      });
    }
    const given = new Map(
      scores.map((item) => [item.criterionId, item.points]),
    );
    const incomplete = new BadRequestException({
      code: 'RUBRIC_SCORES_INCOMPLETE',
      message: 'Give exactly one score for every Rubric criterion.',
    });
    if (given.size !== scores.length || given.size !== rubric.length) {
      throw incomplete;
    }
    let earned = 0;
    let possible = 0;
    for (const criterion of rubric) {
      const points = given.get(criterion.id);
      if (points === undefined) throw incomplete;
      if (points > criterion.maxPoints) {
        throw new BadRequestException({
          code: 'RUBRIC_SCORE_OUT_OF_RANGE',
          message: `A criterion score cannot exceed ${criterion.maxPoints} points.`,
        });
      }
      earned += points;
      possible += criterion.maxPoints;
    }
    return roundScore((earned / possible) * 100);
  }

  private notAwaitingInstructor() {
    return new ConflictException({
      code: 'SUBMISSION_NOT_AWAITING_INSTRUCTOR',
      message:
        'This submission is not waiting for Instructor grading. Reload the page to see its current state.',
    });
  }

  private submissionNotFound() {
    return new NotFoundException({
      code: 'SUBMISSION_NOT_FOUND',
      message: 'Submission not found.',
    });
  }

  private requireInstructor(user: CurrentUser): string {
    if (user.role !== 'INSTRUCTOR' || !user.organizationId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Only an Instructor can review submissions.',
      });
    }
    return user.organizationId;
  }

  private async requireOwnCourse(user: CurrentUser, courseId: string) {
    const course = await this.courses.getAuthoringContext(courseId, user);
    if (
      course.organizationId !== user.organizationId ||
      course.instructorId !== user.userId
    ) {
      throw this.assignmentNotFound();
    }
  }

  private assignmentNotFound() {
    return new NotFoundException({
      code: 'ASSIGNMENT_NOT_FOUND',
      message: 'Assignment not found.',
    });
  }

  private async loadNames(
    user: CurrentUser,
    userIds: string[],
  ): Promise<{ map: Map<string, IUserDisplayName> | null }> {
    if (userIds.length === 0) return { map: new Map() };
    try {
      return { map: await this.tenant.getDisplayNames(user, userIds) };
    } catch (error) {
      this.logger.warn(
        `Learner names unavailable: ${(error as Error).message}`,
      );
      return { map: null };
    }
  }

  private learnerOf(
    userId: string,
    names: Map<string, IUserDisplayName> | null,
  ): ILearnerSummary {
    const found = names?.get(userId);
    return {
      id: userId,
      fullName: found?.fullName ?? null,
      email: found?.email ?? null,
      status: found?.status ?? null,
    };
  }

  private fileOf(
    fileKey: string | null,
    fileName: string | null,
    mimeType: string | null,
    sizeBytes: bigint | null,
  ): IAttachedFile | null {
    if (!fileKey) return null;
    let url: string | null = null;
    try {
      url = this.storage.getUrl(fileKey, 'raw');
    } catch {
      url = null;
    }
    return {
      fileName,
      mimeType,
      sizeBytes: sizeBytes === null ? null : Number(sizeBytes),
      url,
    };
  }
}
