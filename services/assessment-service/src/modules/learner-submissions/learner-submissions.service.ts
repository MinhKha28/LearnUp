import type { CurrentUser } from '@learnup/ts-common';
import {
  type IStorageProvider,
  StorageProviderError,
  StorageValidationError,
} from '@learnup/ts-storage';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Prisma } from 'generated/prisma/client';
import { EnrollmentClient } from '../../infrastructure/clients/learning/enrollment.client';
import { STORAGE_PROVIDER } from '../../infrastructure/storage/storage.constants';
import { SubmitAssignmentDto } from './dto/submit-assignment.dto';
import type {
  ICycleWindow,
  ILearnerAssignment,
  ILearnerAttemptState,
  ILearnerSubmissionSummary,
  ISubmissionReceipt,
} from './interfaces/learner-submission.interface';
import {
  LEARNER_STATUS_CHANGED_EVENT,
  NEEDS_INSTRUCTOR_GRADING,
  OPEN_CYCLE_STATUS,
  PEER_REVIEW_DISABLED,
  SUBMISSION_FILE_MAX_BYTES,
  SUBMISSION_FILE_TYPES,
  submissionFolder,
  WAITING_FOR_CYCLE,
} from './learner-submissions.constants';
import {
  type LearnerAssignmentRow,
  LearnerSubmissionsRepository,
  type LearnerStateRow,
  type SubmissionRow,
} from './learner-submissions.repository';
import { cycleWindowFor } from './peer-review-calendar';

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
    const organizationId = this.requireLearner(user);
    const assignment = await this.loadAssignment(organizationId, assessmentId);
    const enrollment = await this.requireEnrollment(user, assignment.courseId);
    const [state, latest, completed] = await Promise.all([
      this.repository.findState(assignment.id, user.userId),
      this.repository.findLatestSubmission(assignment.id, user.userId),
      this.repository.isEnrollmentCompleted(enrollment.enrollmentId),
    ]);

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
      passingScore: Number(assignment.passingScore.toString()),
      expectedDurationMinutes: assignment.expectedDurationMinutes,
      peerReviewEnabled: assignment.peerReviewEnabled,
      rubric: assignment.rubricCriteria.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        maxPoints: c.maxPoints,
      })),
      attempts: this.attemptsOf(assignment, state, this.clock()),
      readOnly: completed,
      latestSubmission: latest ? this.toSummary(latest) : null,
    };
  }

  /** The prompt file of an Assignment the Learner is enrolled in. */
  async downloadPromptFile(user: CurrentUser, assessmentId: string) {
    const organizationId = this.requireLearner(user);
    const assignment = await this.loadAssignment(organizationId, assessmentId);
    await this.requireEnrollment(user, assignment.courseId);
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
   * BR-167: the submission joins the peer review cycle that is open now (created on demand, BR-312).
   * BR-175 / BR-176: n consecutive submissions lock the Assignment for this Learner for m hours.
   * Resubmitting (UC30.1) is a different use case: a Learner who already has a submission is refused here.
   */
  async submit(
    user: CurrentUser,
    assessmentId: string,
    dto: SubmitAssignmentDto,
    uploaded?: UploadedSubmissionFile,
  ): Promise<ISubmissionReceipt> {
    const organizationId = this.requireLearner(user);
    const content = dto.content?.trim() || null;
    if (!content && !uploaded) {
      throw new BadRequestException({
        code: 'SUBMISSION_EMPTY',
        message: 'Write your answer or attach one file.',
      });
    }
    const file = uploaded ? this.validateFile(uploaded) : null;

    const assignment = await this.loadAssignment(organizationId, assessmentId);
    const enrollment = await this.requireEnrollment(user, assignment.courseId);
    // BR-169: a Completed Enrollment is read-only.
    if (await this.repository.isEnrollmentCompleted(enrollment.enrollmentId)) {
      throw new ConflictException({
        code: 'ENROLLMENT_COMPLETED',
        message:
          'This Course is completed, so the Assignment can no longer be submitted.',
      });
    }
    // Cheap early checks, so nothing is uploaded for a request that is going to be refused. They are repeated
    // under the lock below, where a concurrent request can no longer change the answer.
    const [state, previous] = await Promise.all([
      this.repository.findState(assignment.id, user.userId),
      this.repository.findLatestSubmission(assignment.id, user.userId),
    ]);
    this.assertCanSubmit(assignment, state, previous, this.clock());

    const stored = file
      ? await this.storeFile(organizationId, assignment.id, file)
      : null;

    try {
      return await this.repository.transaction(async (tx) => {
        // One request at a time per Learner and Assignment, so the counters of BR-176 cannot be skipped.
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
        this.assertCanSubmit(assignment, current, latest, now);

        // The lock has run out (BR-176): counting starts again from this submission.
        const baseCount = this.lockExpired(current, now)
          ? 0
          : current.consecutiveCount;

        const placement = await this.place(tx, assignment, now);
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
            status: 'Submitted',
            submissionId: submission.id,
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
          attempts: this.attemptsOf(assignment, updated, now),
        };
      });
    } catch (error) {
      // The row was not saved, so the uploaded file belongs to nobody.
      if (stored) await this.removeFile(stored.storageKey);
      throw error;
    }
  }

  // ------------------------------------------------------------------ rules

  /** PRE-2 of UC30: the Assignment is not locked for this Learner; and (UC30.1 is not built yet) no earlier submission. */
  private assertCanSubmit(
    assignment: LearnerAssignmentRow,
    state: LearnerStateRow | null,
    previous: SubmissionRow | null,
    now: Date,
  ) {
    if (state?.lockedUntil && state.lockedUntil.getTime() > now.getTime()) {
      throw new ConflictException({
        code: 'ASSESSMENT_LOCKED',
        message: `You have submitted ${assignment.maxConsecutiveAttempts} times in a row. You can submit again at ${state.lockedUntil.toISOString()}.`,
        lockedUntil: state.lockedUntil.toISOString(),
      });
    }
    if (previous) {
      throw new ConflictException({
        code: 'SUBMISSION_EXISTS',
        message:
          'You have already submitted this Assignment. Resubmitting is not available yet.',
      });
    }
  }

  private lockExpired(state: LearnerStateRow, now: Date): boolean {
    return (
      state.lockedUntil !== null && state.lockedUntil.getTime() <= now.getTime()
    );
  }

  /** BR-179: how many submissions are left and, when locked, until when. */
  private attemptsOf(
    assignment: Pick<
      LearnerAssignmentRow,
      'maxConsecutiveAttempts' | 'lockoutHours'
    >,
    state: LearnerStateRow | null,
    now: Date,
  ): ILearnerAttemptState {
    const n = assignment.maxConsecutiveAttempts;
    const locked =
      state?.lockedUntil !== null &&
      state?.lockedUntil !== undefined &&
      state.lockedUntil.getTime() > now.getTime();
    const counted =
      !state || this.lockExpired(state, now) ? 0 : state.consecutiveCount;
    return {
      maxConsecutiveAttempts: n,
      remainingAttempts: locked ? 0 : Math.max(0, n - counted),
      lockoutHours: assignment.lockoutHours,
      lockedUntil: locked ? state.lockedUntil!.toISOString() : null,
    };
  }

  /**
   * UC30 step 6. With peer review on, the submission goes into the cycle that is open now, creating it when
   * there is none (BR-167, BR-312); otherwise the Instructor grades it directly.
   */
  private async place(
    tx: Prisma.TransactionClient,
    assignment: LearnerAssignmentRow,
    now: Date,
  ) {
    const reviewers = assignment.peerReviewersPerSubmission;
    const scoreGap = toNumber(assignment.peerReviewScoreGap);
    if (!assignment.peerReviewEnabled || !reviewers || scoreGap === null) {
      return {
        cycle: null,
        gradingStatus: NEEDS_INSTRUCTOR_GRADING,
        interventionReason: PEER_REVIEW_DISABLED,
      };
    }

    // Two Learners of the same Assignment must not both create the cycle.
    await this.repository.lock(tx, `cycle:${assignment.id}`);
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
      // BR-269: the values of the Assignment at this moment are copied into the cycle.
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
      gradingStatus: WAITING_FOR_CYCLE,
      interventionReason: null,
    };
  }

  // ------------------------------------------------------------------ file

  /** UC30 step 2: one PDF, DOCX or ZIP of at most 50 MB. The browser-reported type can be anything, so the bytes are checked. */
  private validateFile(file: UploadedSubmissionFile): ValidFile {
    if (file.size > SUBMISSION_FILE_MAX_BYTES) {
      throw new BadRequestException({
        code: 'SUBMISSION_FILE_TOO_LARGE',
        message: 'The file must be 50 MB or smaller.',
      });
    }
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
        message: 'Attach a PDF, DOCX or ZIP file.',
      });
    }
    return {
      buffer: file.buffer,
      fileName,
      mimeType: type.mimeType,
      sizeBytes: file.size,
    };
  }

  /** UC30 step 5: the file goes to Media Storage; it is not counted toward the Subscription storage (BR-288). */
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
            maxSizeBytes: SUBMISSION_FILE_MAX_BYTES,
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

  private requireLearner(user: CurrentUser): string {
    if (user.role !== 'LEARNER' || !user.organizationId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Only a Learner can do this.',
      });
    }
    return user.organizationId;
  }

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

  /** PRE-1 of UC30: the Learner is enrolled in the Course of the Assignment. */
  private async requireEnrollment(user: CurrentUser, courseId: string) {
    const enrollment = await this.enrollments.findEnrollment(courseId, user);
    if (!enrollment) {
      throw new ForbiddenException({
        code: 'NOT_ENROLLED',
        message: 'You are not enrolled in the Course of this Assignment.',
      });
    }
    return enrollment;
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
