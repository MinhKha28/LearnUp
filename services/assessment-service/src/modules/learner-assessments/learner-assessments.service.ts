import type { CurrentUser } from '@learnup/ts-common';
import { Injectable, Logger } from '@nestjs/common';
import { CourseServiceClient } from '../../infrastructure/clients/course/course-service.client';
import { EnrollmentClient } from '../../infrastructure/clients/learning/enrollment.client';
import {
  attemptStateOf,
  isEnrollmentCompleted,
  requireEnrollment,
  requireLearner,
} from '../learner-submissions/learner-access';
import { ASSIGNMENT_KIND } from '../learner-submissions/learner-submissions.constants';
import type {
  ILearnerAssessmentItem,
  ILearnerAssessmentList,
  LearnerAssessmentStatus,
} from './interfaces/learner-assessment.interface';
import { LearnerAssessmentsRepository } from './learner-assessments.repository';

const FINALIZED = 'Finalized';

const toNumber = (value: { toString(): string } | null | undefined) =>
  value === null || value === undefined ? null : Number(value.toString());

type AssessmentRow = Awaited<
  ReturnType<LearnerAssessmentsRepository['findAssessments']>
>[number];

@Injectable()
export class LearnerAssessmentsService {
  private readonly logger = new Logger(LearnerAssessmentsService.name);

  /** The clock of the lock rules; a test replaces it to travel in time. */
  clock: () => Date = () => new Date();

  constructor(
    private readonly repository: LearnerAssessmentsRepository,
    private readonly enrollments: EnrollmentClient,
    private readonly courses: CourseServiceClient,
  ) {}

  /**
   * UC29 - the Quizzes and Assignments of a Course the Learner is enrolled in, with status, recorded score,
   * passing score, tries left (n - consecutive count) and, when locked, the time it opens again.
   */
  async list(
    user: CurrentUser,
    courseId: string,
  ): Promise<ILearnerAssessmentList> {
    const organizationId = requireLearner(user);
    const enrollment = await requireEnrollment(
      this.enrollments,
      user,
      courseId,
    );
    const [rows, readOnly, moduleOrder] = await Promise.all([
      this.repository.findAssessments(organizationId, courseId),
      isEnrollmentCompleted(enrollment, this.repository),
      this.moduleOrder(user, courseId),
    ]);

    const ids = rows.map((row) => row.id);
    const [states, attempts, submissions] = ids.length
      ? await Promise.all([
          this.repository.findStates(user.userId, ids),
          this.repository.findQuizAttempts(user.userId, ids),
          this.repository.findLatestSubmissions(user.userId, ids),
        ])
      : [[], [], []];
    const stateOf = new Map(states.map((s) => [s.assessmentId, s]));
    const attemptsOf = new Map<string, typeof attempts>();
    for (const attempt of attempts) {
      const list = attemptsOf.get(attempt.assessmentId) ?? [];
      list.push(attempt);
      attemptsOf.set(attempt.assessmentId, list);
    }
    const submissionOf = new Map(submissions.map((s) => [s.assessmentId, s]));
    const now = this.clock();

    const items = this.inOrder(rows, moduleOrder).map(
      (row): ILearnerAssessmentItem => {
        const passingScore = Number(row.passingScore.toString());
        const isAssignment = row.kind === ASSIGNMENT_KIND;
        let status: LearnerAssessmentStatus = 'NotStarted';
        let recordedScore: number | null = null;
        let submittedAt: Date | null = null;

        if (isAssignment) {
          const latest = submissionOf.get(row.id);
          if (latest) {
            submittedAt = latest.submittedAt;
            recordedScore = toNumber(latest.finalScore);
            status =
              latest.gradingStatus === FINALIZED && recordedScore !== null
                ? 'Completed'
                : 'AwaitingResult';
          }
        } else {
          const mine = attemptsOf.get(row.id) ?? [];
          const done = mine.filter((a) => a.submittedAt !== null);
          // BR-159: the recorded score of a Quiz is its best attempt.
          const scores = done
            .map((a) => toNumber(a.score))
            .filter((s): s is number => s !== null);
          recordedScore = scores.length ? Math.max(...scores) : null;
          submittedAt = done.reduce<Date | null>(
            (last, a) =>
              a.submittedAt && (!last || a.submittedAt > last)
                ? a.submittedAt
                : last,
            null,
          );
          if (mine.some((a) => a.submittedAt === null)) status = 'InProgress';
          else if (done.length > 0) status = 'Completed';
        }

        return {
          id: row.id,
          kind: isAssignment ? 'ASSIGNMENT' : 'QUIZ',
          title: row.title,
          moduleId: row.moduleId,
          isRequired: isAssignment ? true : row.isRequired, // BR-165
          passingScore,
          timeLimitMinutes: row.timeLimitMinutes,
          expectedDurationMinutes: row.expectedDurationMinutes,
          status,
          recordedScore,
          // BR-153: no score yet is "not completed", not "failed".
          passed: recordedScore === null ? null : recordedScore >= passingScore,
          submittedAt: submittedAt?.toISOString() ?? null,
          attempts: attemptStateOf(row, stateOf.get(row.id) ?? null, now),
        };
      },
    );

    return {
      courseId,
      enrollmentId: enrollment.enrollmentId,
      readOnly,
      items,
    };
  }

  /** Module ids in outline order, or null when Course Service cannot say (then the list is ordered by id). */
  private async moduleOrder(
    user: CurrentUser,
    courseId: string,
  ): Promise<string[] | null> {
    try {
      return await this.courses.getModuleIds(courseId, user);
    } catch (error) {
      this.logger.warn(`Module order of ${courseId} unknown: ${String(error)}`);
      return null;
    }
  }

  /** BR-291: Module Quizzes follow the Module order, Course-level Quizzes and Assignments come last; then by position. */
  private inOrder(rows: AssessmentRow[], moduleOrder: string[] | null) {
    const rank = (moduleId: string | null) => {
      if (moduleId === null) return Number.MAX_SAFE_INTEGER;
      const at = moduleOrder?.indexOf(moduleId) ?? -1;
      return at >= 0 ? at : (moduleOrder?.length ?? 0);
    };
    return [...rows].sort(
      (a, b) =>
        rank(a.moduleId) - rank(b.moduleId) ||
        (a.moduleId ?? '').localeCompare(b.moduleId ?? '') ||
        a.position - b.position ||
        a.id.localeCompare(b.id),
    );
  }
}
