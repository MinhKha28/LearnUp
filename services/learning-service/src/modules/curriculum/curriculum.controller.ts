import {
  ApiOperation,
  ApiOkResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { ProgressService, type ProgressView } from './progress.service';
import {
  AssessmentResultsService,
  type AssessmentResultsView,
} from './assessment-results.service';
import type { CurrentUser } from '@learnup/ts-common';
import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { User } from '../../common/decorator/customize';
import { Roles } from '../../common/decorator/roles.decorator';
import {
  CurriculumService,
  type CurriculumView,
  type LessonView,
} from './curriculum.service';

// Không dùng ParseUUIDPipe: id sai định dạng trả 404 như không tìm thấy, giống UC25.1 của course-service
@Controller('enrollments')
export class CurriculumController {
  constructor(
    private readonly service: CurriculumService,
    private readonly progress: ProgressService,
    private readonly results: AssessmentResultsService,
  ) {}

  @Get(':enrollmentId/progress')
  @Roles('LEARNER')
  @ApiOperation({
    summary: 'UC28: read own completion conditions; never updates progress',
  })
  @ApiOkResponse({
    description:
      'Completed summary, or materials and assessment conditions (assessment may be unavailable)',
  })
  @ApiForbiddenResponse({
    description: 'CONTENT_UNAVAILABLE, same as curriculum',
  })
  @ApiNotFoundResponse({
    description: 'ENROLLMENT_NOT_FOUND, same as curriculum',
  })
  getProgress(
    @User() user: CurrentUser,
    @Param('enrollmentId') enrollmentId: string,
  ): Promise<ProgressView> {
    return this.progress.getProgress(user, enrollmentId);
  }

  @Get(':enrollmentId/assessment-results')
  @Roles('LEARNER')
  @ApiOperation({
    summary:
      'UC28.1: scores of the Quizzes and Assignments done in the Course, against the passing scores; never writes',
  })
  @ApiOkResponse({
    description:
      'state ok with summary and items, or state unavailable when assessment-service cannot be asked',
  })
  @ApiForbiddenResponse({
    description: 'CONTENT_UNAVAILABLE, same as curriculum',
  })
  @ApiNotFoundResponse({
    description: 'ENROLLMENT_NOT_FOUND, same as curriculum',
  })
  getAssessmentResults(
    @User() user: CurrentUser,
    @Param('enrollmentId') enrollmentId: string,
  ): Promise<AssessmentResultsView> {
    return this.results.getResults(user, enrollmentId);
  }

  /** UC27: chương trình học của một Enrollment. */
  @Get(':enrollmentId/curriculum')
  @Roles('LEARNER')
  getCurriculum(
    @User() user: CurrentUser,
    @Param('enrollmentId') enrollmentId: string,
  ): Promise<CurriculumView> {
    return this.service.getCurriculum(user, enrollmentId);
  }

  /** UC27.1: chi tiết một Lesson trong phiên bản của Enrollment. */
  @Get(':enrollmentId/lessons/:lessonId')
  @Roles('LEARNER')
  getLesson(
    @User() user: CurrentUser,
    @Param('enrollmentId') enrollmentId: string,
    @Param('lessonId') lessonId: string,
  ): Promise<LessonView> {
    return this.service.getLesson(user, enrollmentId, lessonId);
  }

  @Get('course/:courseId/lessons/:lessonId/completion')
  @Roles('INSTRUCTOR')
  getLessonCompletion(
    @User() user: CurrentUser,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
  ) {
    return this.service.hasAnyLearnerCompletedLesson(user, courseId, lessonId);
  }
}
