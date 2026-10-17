import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Body,
  Post,
} from '@nestjs/common';
import type { CurrentUser } from '@learnup/ts-common';
import { ResponseMessage, User } from '@common/decorator/customize';
import { CoursesService } from '@courses/courses.service';
import { CourseListQueryDto } from '@courses/dto/course-list-query.dto';
import { CreateCourseDto } from '@courses/dto/create-course.dto';
import { CreateCourseModuleDto } from '@courses/dto/create-course-module.dto';
import { CreateCourseLessonDto } from '@courses/dto/create-course-lesson.dto';
import { OrganizationCourseListQueryDto } from '@courses/dto/organization-course-list-query.dto';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  @ResponseMessage('Courses fetched successfully')
  findAll(@User() user: CurrentUser, @Query() query: CourseListQueryDto) {
    return this.coursesService.findAll(user, query);
  }

  @Get(':id/authoring-context')
  @ResponseMessage('Course authoring context retrieved successfully.')
  getAuthoringContext(
    @Param('id', ParseUUIDPipe) id: string,
    @User() user: CurrentUser,
  ) {
    return this.coursesService.getAuthoringContext(id, user.organizationId);
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

  @Get('organization/instructors')
  @ResponseMessage('Organization Course instructors fetched successfully')
  getOrganizationCourseInstructors(@User() user: CurrentUser) {
    return this.coursesService.getOrganizationCourseInstructors(user);
  }

  @Get('organization')
  @ResponseMessage('Organization Courses fetched successfully')
  findOrganizationCourses(
    @User() user: CurrentUser,
    @Query() query: OrganizationCourseListQueryDto,
  ) {
    return this.coursesService.findOrganizationCourses(user, query);
  }

  @Get(':courseId')
  @ResponseMessage('Course details fetched successfully')
  findDetail(
    @User() user: CurrentUser,
    @Param('courseId', ParseUUIDPipe) courseId: string,
  ) {
    return this.coursesService.findDetail(user, courseId);
  }
}
