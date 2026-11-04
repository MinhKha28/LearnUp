import {
  ApiOperation,
  ApiOkResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { ProgressService, type ProgressView } from './progress.service';
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
