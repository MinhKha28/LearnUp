import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import type { CurrentUser } from '@learnup/ts-common';
import { ResponseMessage, User } from '../common/decorator/customize';
import { CoursesService } from './courses.service';
import { CourseListQueryDto } from './dto/course-list-query.dto';

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
}
