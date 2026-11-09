import type { CurrentUser } from '@learnup/ts-common';
import type { IStorageProvider } from '@learnup/ts-storage';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { EnrollmentClient } from '../../infrastructure/clients/learning/enrollment.client';
import { STORAGE_PROVIDER } from '../../infrastructure/storage/storage.constants';
import {
  requireAccess,
  requireLearner,
} from '../learner-submissions/learner-access';
import { scoreFromRubric } from '../peer-review/rubric-score';
import { ListHistoryQueryDto } from './dto/list-history-query.dto';
import { ListReviewsQueryDto } from './dto/list-reviews-query.dto';
import { SubmitReviewDto } from './dto/submit-review.dto';
import type {
  ILearnerReviewDetail,
  ILearnerReviewItem,
  ILearnerReviewList,
  ILearnerReviewResult,
  IReviewHistory,
  IReviewHistoryItem,
} from './interfaces/learner-review.interface';
import {
  type HistoryRow,
  LearnerReviewsRepository,
  type ReviewRow,
} from './learner-reviews.repository';
import { buildObligations, overallObligation } from './review-history';
import {
  neutralFileName,
  outcomeOfReviews,
  reviewStateOf,
} from './review-rules';

const ROUTE = '/api/v1/assessments/learner';

const toNumber = (value: { toString(): string } | null | undefined) =>
  value === null || value === undefined ? null : Number(value.toString());

/**
 * UC31 (the reviews assigned to the Learner) and UC31.1 (giving one). A Learner sees the work to review without its
 * author (BR-233), reviews it against the Rubric (BR-257) before the deadline of the cycle (BR-229), and a Completed
 * Enrollment does not stop them: the reviews already handed out are still owed (BR-211).
 */
@Injectable()
export class LearnerReviewsService {
  /** The clock of every rule below; a test replaces it to travel in time. */
  clock: () => Date = () => new Date();

  constructor(
    private readonly repository: LearnerReviewsRepository,
    private readonly enrollments: EnrollmentClient,
    @Inject(STORAGE_PROVIDER) private readonly storage: IStorageProvider,
  ) {}

  /**
   * UC31 — the reviews assigned to the Learner, one page at a time: the ones to give first (the earliest deadline first),
   * then the given, then the closed. The number still to give counts the whole queue, so it does not depend on the page.
   */
  async list(
    user: CurrentUser,
    query: ListReviewsQueryDto = new ListReviewsQueryDto(),
  ): Promise<ILearnerReviewList> {
    const organizationId = requireLearner(user);
    const now = this.clock();
    const { page, pageSize } = query;
    const [counts, rows] = await Promise.all([
      this.repository.countQueue(organizationId, user.userId, now),
      this.repository.pageOfQueue(
        organizationId,
        user.userId,
        now,
        pageSize,
        (page - 1) * pageSize,
      ),
    ]);
    return {
      pendingCount: counts.open,
      total: counts.total,
      page,
      pageSize,
      items: rows.map((row) => this.toItem(row, now)),
    };
  }

  /**
   * UC31.2 — the reviews the Learner has given, newest first, and where the duty stands: for each Assignment and as a whole.
   * The duty is judged by the rule learning-service uses for the Certificate, so the two agree. Nothing in it says who
   * wrote the work (BR-233); a review is only listed once it is given and final (BR-257).
   */
  async history(
    user: CurrentUser,
    query: ListHistoryQueryDto = new ListHistoryQueryDto(),
  ): Promise<IReviewHistory> {
    const organizationId = requireLearner(user);
    const now = this.clock();
    const { page, pageSize, assignmentId } = query;
    const [facts, total, rows] = await Promise.all([
      this.repository.obligationRows(organizationId, user.userId),
      this.repository.countGiven(organizationId, user.userId, assignmentId),
      this.repository.pageOfGiven(
        organizationId,
        user.userId,
        pageSize,
        (page - 1) * pageSize,
        assignmentId,
      ),
    ]);
    const obligations = buildObligations(facts, now);
    return {
      overall: overallObligation(obligations),
      obligations,
      assignedCount: obligations.reduce((sum, o) => sum + o.requiredCount, 0),
      completedCount: obligations.reduce((sum, o) => sum + o.completedCount, 0),
      total,
      page,
      pageSize,
      items: rows.map((row) => this.toHistoryItem(row)),
    };
  }

  private toHistoryItem(row: HistoryRow): IReviewHistoryItem {
    const assessment = row.submission.assessment;
    const given = new Map(row.scores.map((s) => [s.criterionId, s.points]));
    return {
      id: row.id,
      assignmentId: assessment.id,
      assignmentTitle: assessment.title,
      courseId: assessment.courseId,
      score: toNumber(row.score),
      completedAt: row.completedAt?.toISOString() ?? null,
      comment: row.comment,
      criteria: assessment.rubricCriteria.map((criterion) => ({
        criterionId: criterion.id,
        name: criterion.name,
        points: given.get(criterion.id) ?? 0,
        maxPoints: criterion.maxPoints,
      })),
    };
  }

  /** UC31 — one review to give, or given: the work, the Rubric and the review so far. */
  async detail(
    user: CurrentUser,
    reviewId: string,
  ): Promise<ILearnerReviewDetail> {
    const review = await this.load(user, reviewId);
    const assignment = review.submission.assessment;
    const submission = review.submission;
    return {
      ...this.toItem(review, this.clock()),
      assignment: {
        prompt: assignment.prompt,
        rubric: assignment.rubricCriteria,
        promptFileUrl: assignment.promptFileKey
          ? `${ROUTE}/assignments/${assignment.id}/prompt-file`
          : null,
        promptFileName: assignment.promptFileKey
          ? assignment.promptFileName
          : null,
      },
      submission: {
        content: submission.content,
        file: submission.fileKey
          ? {
              fileName: neutralFileName(submission.fileMime),
              mimeType: submission.fileMime,
              sizeBytes:
                submission.fileSizeBytes === null
                  ? null
                  : Number(submission.fileSizeBytes),
              url: `${ROUTE}/peer-reviews/${review.id}/file`,
            }
          : null,
      },
      myReview:
        review.status === 'Completed'
          ? {
              comment: review.comment,
              scores: review.scores.map((score) => ({
                criterionId: score.criterionId,
                points: score.points,
              })),
            }
          : null,
    };
  }

  /** UC31 — the file of the work, through this service so that nothing in the address or the name says whose it is. */
  async file(user: CurrentUser, reviewId: string) {
    const review = await this.load(user, reviewId);
    const submission = review.submission;
    if (!submission.fileKey) {
      throw new NotFoundException({
        code: 'REVIEW_FILE_NOT_FOUND',
        message: 'This submission has no file.',
      });
    }
    const response = await fetch(
      this.storage.getUrl(submission.fileKey, 'raw'),
    ).catch(() => null);
    if (!response) {
      throw new ServiceUnavailableException({
        code: 'STORAGE_UNAVAILABLE',
        message: 'Unable to read the file. Try again later.',
      });
    }
    if (!response.ok) {
      throw new NotFoundException({
        code: 'REVIEW_FILE_NOT_FOUND',
        message: 'The file is no longer available.',
      });
    }
    return {
      content: Buffer.from(await response.arrayBuffer()),
      fileName: neutralFileName(submission.fileMime),
      mimeType: submission.fileMime ?? 'application/octet-stream',
    };
  }

  /**
   * UC31.1 — give the review: a score for every criterion of the Rubric and a general comment (BR-257). It is final once
   * given. The review that completes the set handed out for the submission decides where the submission goes: to its grade
   * when the peers agree, to the Instructor when they differ by more than the threshold (BR-252, BR-253).
   */
  async submit(
    user: CurrentUser,
    reviewId: string,
    dto: SubmitReviewDto,
  ): Promise<ILearnerReviewResult> {
    const first = await this.load(user, reviewId);
    const organizationId = first.organizationId;
    const submissionId = first.submission.id;

    return this.repository.transaction(async (tx) => {
      // The reviews of one submission take turns: the one that comes last sees all the others.
      await this.repository.lockSubmission(tx, submissionId);
      // The deadline (BR-229) is judged now, when this caller holds the turn, on the clock of the database: a review that
      // waited for the lock while the deadline passed is refused, and the time it is given at is the time it really was.
      const now = await this.repository.databaseNow(tx);
      const review = await this.repository.findOne(
        organizationId,
        user.userId,
        reviewId,
        tx,
      );
      if (!review) throw this.notFound();

      const state = reviewStateOf(review, review.cycle, now);
      if (state === 'Done') throw this.alreadyGiven();
      if (state === 'Closed') {
        throw new ConflictException({
          code: 'REVIEW_CLOSED',
          message:
            'The deadline of this review has passed, so it can no longer be given.',
        });
      }

      const assignment = review.submission.assessment;
      const score = scoreFromRubric(assignment.rubricCriteria, dto.scores);
      const given = await this.repository.complete(tx, review, {
        score,
        comment: dto.comment,
        completedAt: now,
        scores: dto.scores,
      });
      if (!given) throw this.alreadyGiven();

      const peers = await this.repository.peerReviewsOf(tx, submissionId);
      if (peers.every((peer) => peer.status === 'Completed')) {
        await this.repository.moveOn(
          tx,
          submissionId,
          outcomeOfReviews(
            peers.map((peer) => Number(peer.score?.toString())),
            Number(review.cycle?.scoreGap.toString()),
          ),
        );
      }

      const learnerState = await this.repository.ensureState(
        tx,
        organizationId,
        assignment.id,
        user.userId,
        now,
      );
      await this.repository.emitSignal(tx, {
        stateId: learnerState.id,
        organizationId,
        assessmentId: assignment.id,
        courseId: assignment.courseId,
        learnerId: user.userId,
        kind: 'ASSIGNMENT',
        reason: 'PEER_REVIEW_COMPLETED',
        status: 'PeerReviewCompleted',
        extra: { reviewId: review.id },
        now,
      });

      return {
        id: review.id,
        status: 'Completed',
        score,
        completedAt: now.toISOString(),
        remainingInAssignment: await this.repository.countOpen(
          tx,
          organizationId,
          user.userId,
          assignment.id,
          now,
        ),
      };
    });
  }

  /** The review of this Learner, when the Enrollment lets them into the Course: Full or ReadOnly, not Halted or Withdrawn (BR-211). */
  private async load(user: CurrentUser, reviewId: string): Promise<ReviewRow> {
    const organizationId = requireLearner(user);
    const review = await this.repository.findOne(
      organizationId,
      user.userId,
      reviewId,
    );
    if (!review) throw this.notFound();
    await requireAccess(
      this.enrollments,
      user,
      review.submission.assessment.courseId,
    );
    return review;
  }

  private toItem(row: ReviewRow, now: Date): ILearnerReviewItem {
    return {
      id: row.id,
      assignmentId: row.submission.assessment.id,
      assignmentTitle: row.submission.assessment.title,
      courseId: row.submission.assessment.courseId,
      status: row.status,
      state: reviewStateOf(row, row.cycle, now),
      reviewDueAt: row.cycle?.reviewDueAt.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      score: toNumber(row.score),
    };
  }

  private notFound() {
    return new NotFoundException({
      code: 'REVIEW_NOT_FOUND',
      message: 'Review not found.',
    });
  }

  private alreadyGiven() {
    return new ConflictException({
      code: 'REVIEW_ALREADY_GIVEN',
      message: 'This review was already given and cannot be changed.',
    });
  }
}
