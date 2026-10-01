import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { ResponseMessage, User } from 'src/common/decorator/customize';
import type { CurrentUser } from '@learnup/ts-common';
import { CourseListQueryDto } from './dto/course-list-query.dto';
import { CreateCourseDto } from './dto/create-course.dto';
import { CreateCourseModuleDto } from './dto/create-course-module.dto';
import { CreateCourseLessonDto } from './dto/create-course-lesson.dto';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  @ResponseMessage('Courses fetched successfully')
  findAll(@User() user: CurrentUser, @Query() query: CourseListQueryDto) {
    return this.coursesService.findAll(user, query);
  }

  @Post()
  @ResponseMessage('Course created successfully')
  create(@User() user: CurrentUser, @Body() dto: CreateCourseDto) {
    return this.coursesService.create(user, dto);
  }

  @Get(':courseId/structure')
  @ResponseMessage('Course structure fetched successfully')
  getStructure(@User() user: CurrentUser, @Param('courseId') courseId: string) {
    return this.coursesService.getStructure(user, courseId);
  }

  @Post(':courseId/modules')
  @ResponseMessage('Module created successfully')
  createModule(
    @User() user: CurrentUser,
    @Param('courseId') courseId: string,
    @Body() dto: CreateCourseModuleDto,
  ) {
    return this.coursesService.createModule(user, courseId, dto);
  }
  @Post(':courseId/modules/:moduleId/lessons')
  @ResponseMessage('Lesson created successfully')
  createLesson(
    @User() user: CurrentUser,
    @Param('courseId') courseId: string,
    @Param('moduleId') moduleId: string,
    @Body() dto: CreateCourseLessonDto,
  ) {
    return this.coursesService.createLesson(user, courseId, moduleId, dto);
  }
}
