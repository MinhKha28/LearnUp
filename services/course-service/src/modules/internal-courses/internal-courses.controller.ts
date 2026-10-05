import type { CurrentUser } from '@learnup/ts-common';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiOkResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ResponseMessage, User } from '@common/decorator/customize';
import { CourseBatchItemDto } from './dto/course-batch-item.dto';
import { CourseBatchQueryDto } from './dto/course-batch-query.dto';
import { CourseTreeDto } from './dto/course-tree.dto';
import { LessonContentDto } from './dto/lesson-content.dto';
import { LockCourseDto } from './dto/lock-course.dto';
import { LockedCourseDto } from './dto/locked-course.dto';
import { InternalCoursesService } from './internal-courses.service';

// Không truyền version: mặc định của ParseUUIDPipe là regex 'all', nhận cả UUID v7.
// Nest 11.2 không cho truyền version: 'all' (kiểu chỉ có '3' | '4' | '5' | '7').
const uuidPipe = new ParseUUIDPipe();

@ApiTags('internal')
@ApiSecurity('internal-key')
@Controller('internal/courses')
export class InternalCoursesController {
  constructor(
    private readonly internalCoursesService: InternalCoursesService,
  ) {}

  @Post('batch')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Courses fetched successfully')
  @ApiOkResponse({ type: [CourseBatchItemDto] })
  findBatch(@User() user: CurrentUser, @Body() body: CourseBatchQueryDto) {
    return this.internalCoursesService.findBatch(
      user.organizationId,
      body.courseIds,
    );
  }

  @Post(':courseId/lock')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Course locked successfully')
  @ApiOkResponse({ type: LockedCourseDto })
  lock(
    @User() user: CurrentUser,
    @Param('courseId', uuidPipe) courseId: string,
    @Body() body: LockCourseDto,
  ) {
    return this.internalCoursesService.lock(
      user.organizationId,
      courseId,
      body.selfEnroll,
    );
  }

  @Get(':courseId/tree')
  @ResponseMessage('Course tree fetched successfully')
  @ApiOkResponse({ type: CourseTreeDto })
  getTree(
    @User() user: CurrentUser,
    @Param('courseId', uuidPipe) courseId: string,
  ) {
    return this.internalCoursesService.getTree(user.organizationId, courseId);
  }

  @Get(':courseId/lessons/:lessonId')
  @ResponseMessage('Lesson fetched successfully')
  @ApiOkResponse({ type: LessonContentDto })
  getLesson(
    @User() user: CurrentUser,
    @Param('courseId', uuidPipe) courseId: string,
    @Param('lessonId', uuidPipe) lessonId: string,
  ) {
    return this.internalCoursesService.getLesson(
      user.organizationId,
      courseId,
      lessonId,
    );
  }
}
