import { Controller, Get, Query } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { ResponseMessage, User } from 'src/common/decorator/customize';
import type { CurrentUser } from '@learnup/ts-common';
import { CourseListQueryDto } from './dto/course-list-query.dto';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}
  @Get()
  @ResponseMessage('Courses fetched successfully')
  findAll(@User() user: CurrentUser, @Query() query: CourseListQueryDto) {
    return this.coursesService.findAll(user, query);
  }
}
