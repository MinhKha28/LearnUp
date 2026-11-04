import { Inject, Injectable, Logger } from '@nestjs/common';
import type { CurrentUser } from '@learnup/ts-common';
import {
  ASSESSMENT_COMPLETION_CLIENT,
  type AssessmentCompletionClient,
  validateCompletionSnapshot,
} from '../../infrastructure/clients/assessment/assessment-completion.client';
import { assessmentConditions } from '../course-completion/assessment-conditions';
import { CurriculumService } from './curriculum.service';

export interface MissingCondition {
  kind: 'material' | 'quiz' | 'assignment' | 'peerReview';
  id: string;
}
type AssessmentItem = ReturnType<typeof assessmentConditions>[number];
export interface ProgressView {
  enrollment: {
    id: string;
    courseId: string;
    status: string;
    enrollmentType: string;
    dueAt: string | null;
    dueTimezone: string | null;
    completedAt: string | null;
    completedLate: boolean | null;
  };
  materials?: {
    materialId: string;
    lessonId: string;
    title: string;
    materialType: string;
    required: boolean;
    done: boolean;
  }[];
  assessment?:
    | { state: 'unavailable' }
    | { state: 'ok'; items: Omit<AssessmentItem, 'assessment' | 'learning'>[] };
  /** null counts mean the full set of assessment conditions is unknown. */
  conditions?: {
    state: 'ok' | 'unavailable';
    met: number | null;
    total: number | null;
    missing: MissingCondition[];
  };
}

@Injectable()
export class ProgressService {
  private readonly logger = new Logger(ProgressService.name);
  constructor(
    private readonly curriculum: CurriculumService,
    @Inject(ASSESSMENT_COMPLETION_CLIENT)
    private readonly assessment: AssessmentCompletionClient,
  ) {}

  async getProgress(
    user: CurrentUser,
    enrollmentId: string,
  ): Promise<ProgressView> {
    const e = await this.curriculum.findAccessibleEnrollment(
      user,
      enrollmentId,
    );
    const result: ProgressView = {
      enrollment: {
        id: e.id,
        courseId: e.courseId,
        status: e.status,
        enrollmentType: e.enrollmentType,
        dueAt: e.dueAt?.toISOString() ?? null,
        dueTimezone: e.dueTimezone,
        completedAt: e.completedAt?.toISOString() ?? null,
        completedLate: e.completedLate,
      },
    };
    // Completed is historical: neither today's tree nor today's assessment facts apply.
    if (e.storedStatus === 'Completed') return result;

    const curriculum = await this.curriculum.getProgressCurriculum(user, e);
    const materials = curriculum.visibleLessons.flatMap((lesson) =>
      lesson.materials.map((material) => ({
        materialId: material.materialId,
        lessonId: lesson.lessonId,
        title: material.title,
        materialType: material.materialType,
        required: material.isRequired,
        done: material.completed,
      })),
    );
    const required = materials.filter((m) => m.required);
    const missing: MissingCondition[] = required
      .filter((m) => !m.done)
      .map((m) => ({ kind: 'material', id: m.materialId }));
    let total = required.length;
    let met = required.filter((m) => m.done).length;
    let assessment: ProgressView['assessment'];
    try {
      const snapshot = validateCompletionSnapshot(
        await this.assessment.getCompletionSnapshot(
          user.organizationId!,
          user.userId,
          e.courseId,
        ),
        user.organizationId!,
        user.userId,
        e.courseId,
      );
      const items = assessmentConditions(snapshot).map((item) => ({
        kind: item.kind,
        assessmentId: item.assessmentId,
        passed: item.passed,
        peerReview: item.peerReview,
      }));
      for (const item of items) {
        total++;
        if (item.passed) met++;
        else missing.push({ kind: item.kind, id: item.assessmentId });
        if (item.peerReview && item.peerReview.status !== 'NotApplicable') {
          total++;
          if (item.peerReview.done) met++;
          else missing.push({ kind: 'peerReview', id: item.assessmentId });
        }
      }
      assessment = { state: 'ok', items };
    } catch {
      this.logger.warn({
        code: 'PROGRESS_ASSESSMENT_UNAVAILABLE',
        enrollmentId: e.id,
      });
      assessment = { state: 'unavailable' };
    }
    return {
      ...result,
      materials,
      assessment,
      conditions: {
        state: assessment.state,
        met: assessment.state === 'ok' ? met : null,
        total: assessment.state === 'ok' ? total : null,
        missing,
      },
    };
  }
}
