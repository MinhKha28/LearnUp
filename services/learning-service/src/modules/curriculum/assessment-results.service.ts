import type { CurrentUser } from '@learnup/ts-common';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ASSESSMENT_RESULTS_CLIENT,
  AssessmentResultsUnavailableError,
  type AssessmentResultItem,
  type AssessmentResultsClient,
} from '../../infrastructure/clients/assessment/assessment-results.client';
import { CurriculumService } from './curriculum.service';

/** How the results stand against the passing scores: the numbers the screen shows above the list. */
export interface AssessmentResultsSummary {
  /** Components the Learner has done something on. */
  total: number;
  passed: number;
  notPassed: number;
  /** Running or waiting for a grade: no score to compare yet (BR-191). */
  pending: number;
}

export interface AssessmentResultsView {
  enrollment: { id: string; courseId: string; status: string };
  /** `unavailable`: assessment-service could not be asked; the screen says so instead of showing an empty list. */
  state: 'ok' | 'unavailable';
  summary?: AssessmentResultsSummary;
  items?: AssessmentResultItem[];
}

/** Disabled components keep their score but are not counted against the Learner (BR-296): they are not in the summary. */
export function summarize(
  items: AssessmentResultItem[],
): AssessmentResultsSummary {
  const counted = items.filter((item) => !item.disabled);
  return {
    total: counted.length,
    passed: counted.filter((i) => i.passed === true).length,
    notPassed: counted.filter((i) => i.passed === false).length,
    pending: counted.filter((i) => i.passed === null).length,
  };
}

@Injectable()
export class AssessmentResultsService {
  private readonly logger = new Logger(AssessmentResultsService.name);

  constructor(
    private readonly curriculum: CurriculumService,
    @Inject(ASSESSMENT_RESULTS_CLIENT)
    private readonly assessment: AssessmentResultsClient,
  ) {}

  /**
   * UC28.1: the scores of the Quizzes and Assignments the Learner has done in the Course of this Enrollment, set against
   * the passing scores. The Enrollment must be the caller's (404 otherwise) and open to them (Halted gives 403, like the
   * rest of the Course screens). A Completed Enrollment still shows its results: they are history. Nothing is written.
   */
  async getResults(
    user: CurrentUser,
    enrollmentId: string,
  ): Promise<AssessmentResultsView> {
    const enrollment = await this.curriculum.findAccessibleEnrollment(
      user,
      enrollmentId,
    );
    const view: AssessmentResultsView = {
      enrollment: {
        id: enrollment.id,
        courseId: enrollment.courseId,
        status: enrollment.status,
      },
      state: 'ok',
    };
    try {
      const results = await this.assessment.getResults(
        user,
        enrollment.courseId,
      );
      return {
        ...view,
        summary: summarize(results.items),
        items: results.items,
      };
    } catch (error) {
      if (!(error instanceof AssessmentResultsUnavailableError)) throw error;
      this.logger.warn({
        code: 'ASSESSMENT_RESULTS_UNAVAILABLE',
        enrollmentId: enrollment.id,
        reason: error.reason,
        httpStatus: error.httpStatus,
      });
      return { ...view, state: 'unavailable' };
    }
  }
}
