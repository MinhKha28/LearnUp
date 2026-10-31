import { Injectable } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ASSIGNMENT_KIND } from '../learner-submissions/learner-submissions.constants';
import { QUIZ_KIND } from '../quiz/interfaces/quiz-list.interface';
import type { AssignmentFacts, QuizFacts } from './completion-snapshot';

const INSTRUCTOR_REVIEWER_ROLE = 'instructor';

interface ComponentRow {
  id: string;
  kind: string;
  passingScore: string;
  attempts: { id: string; attemptNumber: number; score: string }[];
  latest: {
    id: string;
    gradingStatus: string;
    finalScore: string | null;
    finalizedAt: string | null;
  } | null;
  reviews: {
    status: string;
    reviewDueAt: string | null;
    cycleId: string | null;
    cycleClosesAt: string | null;
  }[];
  exemptedAt: string | null;
}

export interface CourseFacts {
  quizzes: QuizFacts[];
  assignments: AssignmentFacts[];
}

/** What one Learner did in one Course (the version). */
@Injectable()
export class CompletionSnapshotRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The required components of the Course (BR-206: every Assignment, and the Quizzes marked required; a Disabled
   * Assessment is no longer part of the Course) with the facts of the Learner on each, in the order of the outline
   * so the answer is stable. One statement and one round trip: learning asks for this once per Learner it evaluates,
   * so the cost of a reading is mostly the number of statements, not their size (every lookup below uses an index).
   *  - attempts: Quiz attempts that were submitted and graded; an open attempt is no result.
   *  - latest: the newest submission that was not replaced (BR-170).
   *  - reviews: the reviews the Learner owes or gave as a peer, with the cycle they belong to and its closing line and
   *    review deadline (the state is read from the latest cycle, BR-239); the Instructor's own rows are not peer
   *    reviews (the role is compared without case, as UC25.4 does).
   */
  async findFacts(
    organizationId: string,
    learnerId: string,
    courseId: string,
  ): Promise<CourseFacts> {
    const rows = await this.prisma.$queryRaw<ComponentRow[]>(Prisma.sql`
      SELECT a.id,
             a.kind,
             a.passing_score::text AS "passingScore",
             COALESCE((
               SELECT json_agg(json_build_object('id', q.id, 'attemptNumber', q.attempt_number, 'score', q.score::text))
               FROM quiz_attempts q
               WHERE q.assessment_id = a.id AND q.organization_id = ${organizationId}::uuid
                 AND q.learner_id = ${learnerId}::uuid AND q.submitted_at IS NOT NULL AND q.score IS NOT NULL
             ), '[]'::json) AS attempts,
             (
               SELECT json_build_object('id', s.id, 'gradingStatus', s.grading_status,
                                        'finalScore', s.final_score::text, 'finalizedAt', s.finalized_at)
               FROM submissions s
               WHERE s.assessment_id = a.id AND s.organization_id = ${organizationId}::uuid
                 AND s.learner_id = ${learnerId}::uuid AND s.superseded_at IS NULL
               ORDER BY s.submission_number DESC
               LIMIT 1
             ) AS latest,
             COALESCE((
               SELECT json_agg(json_build_object('status', r.status, 'reviewDueAt', c.review_due_at,
                                                 'cycleId', r.cycle_id, 'cycleClosesAt', c.closes_at))
               FROM submission_reviews r
               JOIN submissions rs ON rs.id = r.submission_id
               LEFT JOIN peer_review_cycles c ON c.id = r.cycle_id
               WHERE rs.assessment_id = a.id AND r.organization_id = ${organizationId}::uuid
                 AND r.reviewer_id = ${learnerId}::uuid
                 AND lower(r.reviewer_role) <> ${INSTRUCTOR_REVIEWER_ROLE}
             ), '[]'::json) AS reviews,
             (
               SELECT st.exempted_at
               FROM learner_assessment_states st
               WHERE st.assessment_id = a.id AND st.organization_id = ${organizationId}::uuid
                 AND st.learner_id = ${learnerId}::uuid
             ) AS "exemptedAt"
      FROM assessments a
      WHERE a.organization_id = ${organizationId}::uuid AND a.course_id = ${courseId}::uuid AND a.disabled_at IS NULL
        AND (a.kind = ${ASSIGNMENT_KIND} OR (a.kind = ${QUIZ_KIND} AND a.is_required))
      ORDER BY a.module_id ASC NULLS LAST, a.position ASC, a.id ASC
    `);

    const quizzes: QuizFacts[] = [];
    const assignments: AssignmentFacts[] = [];
    for (const row of rows) {
      if (row.kind === ASSIGNMENT_KIND) {
        assignments.push({
          assessmentId: row.id,
          passingScore: row.passingScore,
          latest: row.latest && {
            id: row.latest.id,
            gradingStatus: row.latest.gradingStatus,
            finalScore: row.latest.finalScore,
            finalizedAt: row.latest.finalizedAt
              ? new Date(row.latest.finalizedAt)
              : null,
          },
          exemptedAt: row.exemptedAt ? new Date(row.exemptedAt) : null,
          reviews: row.reviews.map((review) => ({
            status: review.status,
            reviewDueAt: review.reviewDueAt
              ? new Date(review.reviewDueAt)
              : null,
            cycleId: review.cycleId,
            cycleClosesAt: review.cycleClosesAt
              ? new Date(review.cycleClosesAt)
              : null,
          })),
        });
      } else {
        quizzes.push({
          assessmentId: row.id,
          passingScore: row.passingScore,
          attempts: row.attempts,
        });
      }
    }
    return { quizzes, assignments };
  }

  /**
   * The Quiz attempts of the Learner in the Course that ran past their deadline and were never submitted (UC29.1).
   * A frame only: grading an attempt that timed out belongs to UC29.1, which does not exist yet, and until then nothing
   * writes `quiz_attempts`, so there is nothing to settle. It changes no row, so calling it again changes nothing.
   * When UC29.1 comes, the conditional update `WHERE submitted_at IS NULL AND deadline_at <= now` goes here and the
   * snapshot calls it before it reads (it is left out of the reading now so that it does not cost a statement for nothing).
   */
  async settleExpiredAttempts(
    organizationId: string,
    learnerId: string,
    courseId: string,
    now: Date,
  ): Promise<number> {
    return this.prisma.quizAttempt.count({
      where: {
        organizationId,
        learnerId,
        assessment: { courseId },
        submittedAt: null,
        deadlineAt: { lte: now },
      },
    });
  }
}
