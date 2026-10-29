import type { CurrentUser } from '@learnup/ts-common';
import {
  type IStorageProvider,
  StorageProviderError,
  StorageValidationError,
} from '@learnup/ts-storage';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Prisma } from 'generated/prisma/client';
import {
  EnrollmentClient,
} from '../../infrastructure/clients/learning/enrollment.client';
import { STORAGE_PROVIDER } from '../../infrastructure/storage/storage.constants';
import {
  fileTooLarge,
  uploadLimitBytes,
} from '../../infrastructure/storage/upload-limit';
import { SubmitAssignmentDto } from './dto/submit-assignment.dto';
import type {
  ICycleWindow,
  IGradingResult,
  ILearnerAssignment,
  ILearnerSubmissionSummary,
  ISubmissionReceipt,
} from './interfaces/learner-submission.interface';
import {
  LEARNER_STATUS_CHANGED_EVENT,
  AWAITING_INSTRUCTOR,
  FINALIZED,
  OPEN_CYCLE_STATUS,
  PEER_REVIEW_DISABLED,
  SUBMISSION_FILE_MAX_BYTES,
  SUBMISSION_FILE_TYPES,
  submissionFolder,
  AWAITING_PEER_REVIEW,
} from './learner-submissions.constants';
import {
  type LearnerAssignmentRow,
  LearnerSubmissionsRepository,
  type LearnerStateRow,
  type SubmissionRow,
} from './learner-submissions.repository';
import {
  attemptStateOf,
  assertCanWrite,
  isReadOnly,
  lockExpired,
  requireAccess,
  requireLearner,
} from './learner-access';
import { cycleLockKey } from '../peer-review/cycle-lock';
import { buildGradingResult } from './grading-result';
import { cycleWindowFor } from './peer-review-calendar';
import {
  decideResubmission,
  isPeerReviewOn,
  owesPeerReviewDuty,
  type SubmissionPlacement,
} from './resubmission-placement';

const HOUR_MS = 3_600_000;
const DEFAULT_CYCLE_DAYS = 7;
const DEFAULT_REVIEW_DAYS = 3;
const DEFAULT_REMINDER_HOURS = 24;

const toNumber = (value: { toString(): string } | null | undefined) =>
  value === null || value === undefined ? null : Number(value.toString());

/** What multer hands over. */
export interface UploadedSubmissionFile {
  buffer: Buffer;
  originalname: string;
  size: number;
}

/** UC30 saves the first submission, UC30.1 a replacement of the previous one. */
type SubmissionMode = 'FIRST' | 'RESUBMIT';

interface ValidFile {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

@Injectable()
export class LearnerSubmissionsService {
  private readonly logger = new Logger(LearnerSubmissionsService.name);

  /** The clock of every rule below; a test replaces it to travel in time. */
  clock: () => Date = () => new Date();

  constructor(
    private readonly repository: LearnerSubmissionsRepository,
    private readonly enrollments: EnrollmentClient,
    @Inject(STORAGE_PROVIDER) private readonly storage: IStorageProvider,
  ) {}

  /** UC30 step 1 — the Assignment as the enrolled Learner reads it, with the attempts left. */
  async getAssignment(
    user: CurrentUser,
    assessmentId: string,
  ): Promise<ILearnerAssignment> {
    const organizationId = requireLearner(user);
    const assignment = await this.loadAssignment(organizationId, assessmentId);
    const access = await requireAccess(
      this.enrollments,
      user,
      assignment.courseId,
    );
    const completed = isReadOnly(access);
    const [state, latest, reviews] = await Promise.all([
      this.repository.findState(assignment.id, user.userId),
      this.repository.findLatestSubmission(assignment.id, user.userId),
      this.repository.findPeerReviews(assignment.id, user.userId),
    ]);
    const now = this.clock();
    let resubmission: ILearnerAssignment['resubmission'] = null;
    if (latest && !completed) {
      const previousCycle = latest.cycleId
        ? await this.repository.findCycleById(latest.cycleId)
        : null;
      const decision = decideResubmission({
        peerReviewOn: isPeerReviewOn(assignment),
        previousCycle,
        owesDuty: owesPeerReviewDuty(state, reviews, now),
        now,
      });
      resubmission = {
        placement: decision.placement,
        cycleClosesAt:
          decision.placement === 'REPLACES_IN_CYCLE' && previousCycle
            ? previousCycle.closesAt.toISOString()
            : null,
      };
    }

    return {
      id: assignment.id,
      courseId: assignment.courseId,
      title: assignment.title,
      prompt: assignment.prompt,
      promptFile: assignment.promptFileKey
        ? {
            fileName: assignment.promptFileName ?? 'prompt.pdf',
            sizeBytes: Number(assignment.promptFileSizeBytes ?? 0),
          }
        : null,
      maxFileBytes: uploadLimitBytes(SUBMISSION_FILE_MAX_BYTES),
      passingScore: Number(assignment.passingScore.toString()),
      expectedDurationMinutes: assignment.expectedDurationMinutes,
      peerReviewEnabled: assignment.peerReviewEnabled,
      rubric: assignment.rubricCriteria.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        maxPoints: c.maxPoints,
      })),
      attempts: attemptStateOf(assignment, state, now),
      readOnly: completed,
      latestSubmission: latest ? this.toSummary(latest) : null,
      resubmission,
    };
  }

  /** UC30.2 — the grading result of a Finalized submission of the Learner (BR-212, BR-234, BR-256, BR-255). */
  async getResult(
    user: CurrentUser,
    assessmentId: string,
    submissionId: string,
  ): Promise<IGradingResult> {
    const organizationId = requireLearner(user);
    const assignment = await this.loadAssignment(organizationId, assessmentId);
    await requireAccess(this.enrollments, user, assignment.courseId);
    return this.resultOf(organizationId, assignment, user.userId, submissionId);
  }

  /**
   * UC30.2 — the result of the latest submission, in one request: the screen does not need to read the Assignment
   * first to learn the id, so Learning Service is asked once (BR-210).
   */
  async getLatestResult(
    user: CurrentUser,
    assessmentId: string,
  ): Promise<IGradingResult> {
    const organizationId = requireLearner(user);
    const assignment = await this.loadAssignment(organizationId, assessmentId);
    await requireAccess(this.enrollments, user, assignment.courseId);
    const latest = await this.repository.findLatestSubmission(
      assignment.id,
      user.userId,
    );
    if (!latest) {
      throw new NotFoundException({
        code: 'SUBMISSION_NOT_FOUND',
        message: 'You have not submitted this Assignment yet.',
      });
    }
    return this.resultOf(organizationId, assignment, user.userId, latest.id);
  }

  private async resultOf(
    organizationId: string,
    assignment: Awaited<ReturnType<LearnerSubmissionsService['loadAssignment']>>,
    learnerId: string,
    submissionId: string,
  ): Promise<IGradingResult> {
    const submission = await this.repository.findSubmissionWithReviews(
      organizationId,
      assignment.id,
      submissionId,
      learnerId,
    );
    if (!submission) {
      throw new NotFoundException({
        code: 'SUBMISSION_NOT_FOUND',
        message: 'The submission does not exist.',
      });
    }
    // PRE-1: only a Finalized submission has a result to show.
    if (
      submission.gradingStatus !== FINALIZED ||
      submission.finalScore === null ||
      !submission.finalizedAt
    ) {
      throw new ConflictException({
        code: 'SUBMISSION_NOT_FINALIZED',
        message: 'The result is not available yet. The submission is still being graded.',
      });
    }
    const finalScore = Number(submission.finalScore.toString());
    const passingScore = Number(assignment.passingScore.toString());
    return {
      submission: {
        id: submission.id,
        submissionNumber: submission.submissionNumber,
        submittedAt: submission.submittedAt.toISOString(),
        fileName: submission.fileName,
      },
      assignment: {
        id: assignment.id,
        courseId: assignment.courseId,
        title: assignment.title,
        passingScore,
      },
      finalScore,
      passed: finalScore >= passingScore,
      finalizationComment: submission.finalizationComment,
      finalizedAt: submission.finalizedAt.toISOString(),
      ...buildGradingResult(assignment.rubricCriteria, submission.reviews),
    };
  }

  /** The prompt file of an Assignment the Learner is enrolled in. */
  async downloadPromptFile(user: CurrentUser, assessmentId: string) {
    const organizationId = requireLearner(user);
    const assignment = await this.loadAssignment(organizationId, assessmentId);
    await requireAccess(this.enrollments, user, assignment.courseId);
    if (!assignment.promptFileKey) {
      throw new NotFoundException({
        code: 'PROMPT_FILE_NOT_FOUND',
        message: 'This Assignment has no prompt file.',
      });
    }
    // The file lives in Cloudinary; fetch it here so the browser keeps talking to this service only.
    const response = await fetch(
      this.storage.getUrl(assignment.promptFileKey, 'raw'),
    ).catch(() => null);
    if (!response) {
      throw new ServiceUnavailableException({
        code: 'STORAGE_UNAVAILABLE',
        message: 'Unable to read the prompt file. Try again later.',
      });
    }
    if (!response.ok) {
      throw new NotFoundException({
        code: 'PROMPT_FILE_NOT_FOUND',
        message: 'The prompt file is no longer available.',
      });
    }
    return {
      content: Buffer.from(await response.arrayBuffer()),
      fileName: assignment.promptFileName ?? 'prompt.pdf',
      mimeType: assignment.promptFileMime ?? 'application/pdf',
    };
  }

  /**
   * UC30 — submit work for an Assignment.
   * BR-208: the submission joins the peer review cycle that is open now (created on demand, BR-231).
   * BR-217 / BR-218: n consecutive submissions lock the Assignment for this Learner for m hours.
   * A Learner who already has a submission uses UC30.1 (resubmit) instead.
   */
  submit(
    user: CurrentUser,
    assessmentId: string,
    dto: SubmitAssignmentDto,
    uploaded?: UploadedSubmissionFile,
  ): Promise<ISubmissionReceipt> {
    return this.create(user, assessmentId, dto, uploaded, 'FIRST');
  }

  /**
   * UC30.1 — replace the previous submission by a new one. There is no limit on the number of resubmissions, before
   * or after the result, until the Enrollment is Completed (BR-209, BR-210); the latest one counts (BR-212).
   * Where it goes: the same cycle when that cycle has not closed yet (BR-213); otherwise straight to the
   * Instructor (A1), unless the Learner owes a peer review duty and joins the open cycle (A2, BR-239).
   * It counts as one more submission in a row (BR-218).
   */
  resubmit(
    user: CurrentUser,
    assessmentId: string,
    dto: SubmitAssignmentDto,
    uploaded?: UploadedSubmissionFile,
  ): Promise<ISubmissionReceipt> {
    return this.create(user, assessmentId, dto, uploaded, 'RESUBMIT');
  }

  /** The pipeline of UC30 and UC30.1: validate, check, store the file, then save everything in one transaction. */
  private async create(
    user: CurrentUser,
    assessmentId: string,
    dto: SubmitAssignmentDto,
    uploaded: UploadedSubmissionFile | undefined,
    mode: SubmissionMode,
  ): Promise<ISubmissionReceipt> {
    const organizationId = requireLearner(user);
    const content = dto.content?.trim() || null;
    if (!content && !uploaded) {
      throw new BadRequestException({
        code: 'SUBMISSION_EMPTY',
        message: 'The answer or file field is required.',
      });
    }
    const file = uploaded ? this.validateFile(uploaded) : null;

    const assignment = await this.loadAssignment(organizationId, assessmentId);
    const access = await requireAccess(
      this.enrollments,
      user,
      assignment.courseId,
    );
    // BR-210: a Completed Enrollment is read-only.
    assertCanWrite(access);
    // Cheap early checks, so nothing is uploaded for a request that is going to be refused. They are repeated
    // under the lock below, where a concurrent request can no longer change the answer.
    const [state, previous] = await Promise.all([
      this.repository.findState(assignment.id, user.userId),
      this.repository.findLatestSubmission(assignment.id, user.userId),
    ]);
    this.assertCanSubmit(assignment, state, previous, this.clock(), mode);

    const stored = file
      ? await this.storeFile(organizationId, assignment.id, file)
      : null;

    let receipt: ISubmissionReceipt;
    try {
      receipt = await this.repository.transaction(async (tx) => {
        // One request at a time per Learner and Assignment, so the counters of BR-218 cannot be skipped.
        await this.repository.lock(tx, `${assignment.id}:${user.userId}`);
        const now = this.clock();
        const current = await this.repository.ensureState(
          tx,
          organizationId,
          assignment.id,
          user.userId,
          now,
        );
        const latest = await this.repository.findLatestSubmission(
          assignment.id,
          user.userId,
          tx,
        );
        this.assertCanSubmit(assignment, current, latest, now, mode);

        // The lock has run out (BR-218): counting starts again from this submission.
        const baseCount = lockExpired(current, now)
          ? 0
          : current.consecutiveCount;

        const placement =
          mode === 'FIRST' || !latest
            ? await this.place(tx, assignment, now)
            : await this.placeResubmission(
                tx,
                assignment,
                latest,
                current,
                now,
              );
        const submission = await this.repository.createSubmission(tx, {
          organizationId,
          assessmentId: assignment.id,
          learnerId: user.userId,
          submissionNumber: await this.repository.nextSubmissionNumber(
            tx,
            assignment.id,
            user.userId,
          ),
          content,
          fileKey: stored?.storageKey ?? null,
          fileName: file?.fileName ?? null,
          fileMime: file?.mimeType ?? null,
          fileSizeBytes: file ? BigInt(file.sizeBytes) : null,
          submittedAt: now,
          cycleId: placement.cycle?.id ?? null,
          gradingStatus: placement.gradingStatus,
          interventionReason: placement.interventionReason,
        });

        // UC30.1 step 4: the new submission takes over, the old one stays as history.
        if (mode === 'RESUBMIT' && latest) {
          await this.repository.markSuperseded(tx, latest.id, now);
        }

        const consecutiveCount = baseCount + 1;
        const lockedUntil =
          consecutiveCount >= assignment.maxConsecutiveAttempts
            ? new Date(now.getTime() + assignment.lockoutHours * HOUR_MS)
            : null;
        const updated = await this.repository.updateState(tx, current.id, {
          consecutiveCount,
          lockedUntil,
          latestSubmissionId: submission.id,
        });
        await this.repository.createOutboxEvent(tx, {
          aggregateType: 'LearnerAssessmentState',
          aggregateId: updated.id,
          eventType: LEARNER_STATUS_CHANGED_EVENT,
          organizationId,
          occurredAt: now,
          payload: {
            assessmentId: assignment.id,
            courseId: assignment.courseId,
            learnerId: user.userId,
            kind: 'ASSIGNMENT',
            status: mode === 'FIRST' ? 'Submitted' : 'Resubmitted',
            submissionId: submission.id,
            previousSubmissionId:
              mode === 'RESUBMIT' ? (latest?.id ?? null) : null,
            consecutiveCount,
            lockedUntil: lockedUntil?.toISOString() ?? null,
          },
        });

        return {
          id: submission.id,
          assessmentId: assignment.id,
          submissionNumber: submission.submissionNumber,
          submittedAt: submission.submittedAt.toISOString(),
          gradingStatus: submission.gradingStatus,
          cycle: placement.cycle ? this.toCycleWindow(placement.cycle) : null,
          attempts: attemptStateOf(assignment, updated, now),
          placement: placement.placement,
          replacedSubmissionId:
            mode === 'RESUBMIT' ? (latest?.id ?? null) : null,
        };
      });
    } catch (error) {
      // The row was not saved, so the uploaded file belongs to nobody.
      if (stored) await this.removeFile(stored.storageKey);
      throw error;
    }
    return receipt;
  }

  // ------------------------------------------------------------------ rules

  /**
   * PRE-2 of UC30 / UC30.1: the Assignment is not locked for this Learner.
   * UC30 is for the first submission, UC30.1 needs a previous one to replace (PRE-1 of UC30.1).
   */
  private assertCanSubmit(
    assignment: LearnerAssignmentRow,
    state: LearnerStateRow | null,
    previous: SubmissionRow | null,
    now: Date,
    mode: SubmissionMode,
  ) {
    if (state?.lockedUntil && state.lockedUntil.getTime() > now.getTime()) {
      throw new ConflictException({
        code: 'ASSESSMENT_LOCKED',
        message: `You have submitted ${assignment.maxConsecutiveAttempts} times in a row. You can submit again at ${state.lockedUntil.toISOString()}.`,
        lockedUntil: state.lockedUntil.toISOString(),
      });
    }
    if (mode === 'FIRST' && previous) {
      throw new ConflictException({
        code: 'SUBMISSION_EXISTS',
        message:
          'You have already submitted this Assignment. Use Resubmit to replace your submission.',
      });
    }
    if (mode === 'RESUBMIT' && !previous) {
      throw new ConflictException({
        code: 'NO_PREVIOUS_SUBMISSION',
        message: 'You have not submitted this Assignment yet.',
      });
    }
  }

  /**
   * UC30 step 6. With peer review on, the submission goes into the cycle that is open now, creating it when
   * there is none (BR-208, BR-231); otherwise the Instructor grades it directly.
   */
  private async place(
    tx: Prisma.TransactionClient,
    assignment: LearnerAssignmentRow,
    now: Date,
  ) {
    const reviewers = assignment.peerReviewersPerSubmission;
    const scoreGap = toNumber(assignment.peerReviewScoreGap);
    if (!isPeerReviewOn(assignment) || !reviewers || scoreGap === null) {
      return {
        cycle: null,
        gradingStatus: AWAITING_INSTRUCTOR,
        interventionReason: PEER_REVIEW_DISABLED,
        placement: 'INSTRUCTOR' as SubmissionPlacement,
      };
    }

    // Two Learners of the same Assignment must not both create the cycle.
    await this.repository.lock(tx, cycleLockKey(assignment.id));
    let cycle = await this.repository.findCycleContaining(
      tx,
      assignment.id,
      now,
    );
    if (!cycle) {
      const [last, settings] = await Promise.all([
        this.repository.findLatestCycle(tx, assignment.id),
        this.repository.findPlatformSetting(),
      ]);
      // BR-335: the values of the Assignment at this moment are copied into the cycle.
      const window = cycleWindowFor(
        now,
        last?.closesAt ?? null,
        assignment.peerReviewCycleDays ??
          settings?.defaultPeerReviewCycleDays ??
          DEFAULT_CYCLE_DAYS,
        assignment.peerReviewDeadlineDays ??
          settings?.defaultPeerReviewDeadlineDays ??
          DEFAULT_REVIEW_DAYS,
      );
      cycle = await this.repository.createCycle(tx, {
        organizationId: assignment.organizationId,
        assessmentId: assignment.id,
        opensAt: window.opensAt,
        closesAt: window.closesAt,
        reviewDueAt: window.reviewDueAt,
        reviewersPerSubmission: reviewers,
        scoreGap,
        reminderHours:
          settings?.peerReviewReminderHours ?? DEFAULT_REMINDER_HOURS,
        status: OPEN_CYCLE_STATUS,
      });
    }
    return {
      cycle,
      gradingStatus: AWAITING_PEER_REVIEW,
      interventionReason: null,
      placement: 'OPEN_CYCLE' as SubmissionPlacement,
    };
  }

  /** UC30.1 step 3, A1 and A2 (BR-213, BR-239): see decideResubmission. */
  private async placeResubmission(
    tx: Prisma.TransactionClient,
    assignment: LearnerAssignmentRow,
    previous: SubmissionRow,
    state: LearnerStateRow,
    now: Date,
  ) {
    // The closing of a cycle takes this lock before it reads the submissions (BR-213). Taken first and read after, the
    // cycle seen here is the one the closing left: either still Open with this work in it, or closed and not joined.
    if (isPeerReviewOn(assignment)) {
      await this.repository.lock(tx, cycleLockKey(assignment.id));
    }
    const previousCycle = previous.cycleId
      ? await this.repository.findCycleById(previous.cycleId, tx)
      : null;
    // Read under the cycle lock above, in the same transaction, so a closing cannot change it between the read and the placement.
    const reviews = await this.repository.findPeerReviews(
      assignment.id,
      previous.learnerId,
      tx,
    );
    const decision = decideResubmission({
      peerReviewOn: isPeerReviewOn(assignment),
      previousCycle,
      owesDuty: owesPeerReviewDuty(state, reviews, now),
      now,
    });
    if (decision.placement === 'REPLACES_IN_CYCLE' && previousCycle) {
      return {
        cycle: previousCycle,
        gradingStatus: AWAITING_PEER_REVIEW,
        interventionReason: null,
        placement: decision.placement,
      };
    }
    if (decision.placement === 'OPEN_CYCLE') {
      return this.place(tx, assignment, now);
    }
    return {
      cycle: null,
      gradingStatus: AWAITING_INSTRUCTOR,
      interventionReason: decision.interventionReason,
      placement: 'INSTRUCTOR' as SubmissionPlacement,
    };
  }

  // ------------------------------------------------------------------ file

  /** UC30 step 2: one PDF, DOCX or ZIP of at most 50 MB. The browser-reported type can be anything, so the bytes are checked. */
  private validateFile(file: UploadedSubmissionFile): ValidFile {
    const limit = uploadLimitBytes(SUBMISSION_FILE_MAX_BYTES);
    if (file.size > limit) throw fileTooLarge(limit);
    // multer reads the name as latin1; turn it back into UTF-8 so accented names survive.
    const fileName = Buffer.from(file.originalname, 'latin1')
      .toString('utf8')
      .split(/[\\/]/)
      .pop()!
      .slice(0, 255);
    const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
    const type = SUBMISSION_FILE_TYPES[extension];
    const signature = type?.signature;
    if (
      !type ||
      !signature ||
      !file.buffer.subarray(0, signature.length).equals(signature)
    ) {
      throw new BadRequestException({
        code: 'SUBMISSION_FILE_INVALID',
        message: 'File must be PDF, DOCX or ZIP, at most 50 MB.',
      });
    }
    return {
      buffer: file.buffer,
      fileName,
      mimeType: type.mimeType,
      sizeBytes: file.size,
    };
  }

  /** UC30 step 5: the file goes to Media Storage; it is not counted toward the Subscription storage (BR-188). */
  private async storeFile(
    organizationId: string,
    assessmentId: string,
    file: ValidFile,
  ) {
    try {
      return await this.storage.upload(
        {
          buffer: file.buffer,
          originalFilename: file.fileName,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
        },
        {
          folder: submissionFolder(organizationId, assessmentId),
          resourceType: 'raw',
          validation: {
            maxSizeBytes: uploadLimitBytes(SUBMISSION_FILE_MAX_BYTES),
            allowedMimeTypes: [file.mimeType],
          },
        },
      );
    } catch (error) {
      if (error instanceof StorageValidationError) {
        throw new BadRequestException({
          code: 'SUBMISSION_FILE_INVALID',
          message: error.message,
        });
      }
      if (error instanceof StorageProviderError && error.code === 'TOO_LARGE') {
        throw fileTooLarge(uploadLimitBytes(SUBMISSION_FILE_MAX_BYTES));
      }
      if (error instanceof StorageProviderError) {
        this.logger.error(`Submission file upload failed: ${error.message}`);
        throw new ServiceUnavailableException({
          code: 'STORAGE_UNAVAILABLE',
          message: 'Unable to store your file. Try again later.',
        });
      }
      throw error;
    }
  }

  /** Best effort: a failure is only logged, the file stays as an orphan. */
  private async removeFile(storageKey: string) {
    try {
      await this.storage.delete(storageKey, { resourceType: 'raw' });
    } catch (error) {
      this.logger.warn(
        `Submission file ${storageKey} was not removed: ${String(error)}`,
      );
    }
  }

  // ------------------------------------------------------------------ guards and mapping

  /** A Disabled Assignment is hidden from Learners like a missing one. */
  private async loadAssignment(organizationId: string, assessmentId: string) {
    const assignment = await this.repository.findAssignment(
      organizationId,
      assessmentId,
    );
    if (!assignment || assignment.disabledAt) {
      throw new NotFoundException({
        code: 'ASSIGNMENT_NOT_FOUND',
        message: 'Assignment not found.',
      });
    }
    return assignment;
  }

  private toSummary(row: SubmissionRow): ILearnerSubmissionSummary {
    return {
      id: row.id,
      submissionNumber: row.submissionNumber,
      submittedAt: row.submittedAt.toISOString(),
      gradingStatus: row.gradingStatus,
      hasFile: row.fileKey !== null,
      fileName: row.fileName,
    };
  }

  private toCycleWindow(cycle: {
    id: string;
    opensAt: Date;
    closesAt: Date;
    reviewDueAt: Date;
  }): ICycleWindow {
    return {
      id: cycle.id,
      opensAt: cycle.opensAt.toISOString(),
      closesAt: cycle.closesAt.toISOString(),
      reviewDueAt: cycle.reviewDueAt.toISOString(),
    };
  }
}
