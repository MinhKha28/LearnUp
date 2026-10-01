import type { CurrentUser } from '@learnup/ts-common';
import { Controller, Get, Param } from '@nestjs/common';
import { User } from '../common/decorator/customize';
import { Roles } from '../common/decorator/roles.decorator';
import {
  CurriculumService,
  type CurriculumView,
  type LessonView,
} from './curriculum.service';

// Không dùng ParseUUIDPipe: id sai định dạng trả 404 như không tìm thấy, giống UC25.1 của course-service
@Controller('enrollments')
export class CurriculumController {
  constructor(private readonly service: CurriculumService) {}

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
}
