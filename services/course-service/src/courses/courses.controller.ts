import { Controller, Post, Body, Get } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { ResponseMessage } from 'src/common/decorator/customize';
// import type { AuthUser } from 'src/common/guards/internal-auth.guard';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @ResponseMessage('Course created successfully')
  @Post()
  create(@Body() createCourseDto: CreateCourseDto) {
    return this.coursesService.create(createCourseDto);
  }

  // @Post()
  // createCourse(@CurrentUser() user: AuthUser) {
  //   return this.coursesService.create(user.id);
  // }

  @ResponseMessage('Courses fetched successfully')
  // @Public()
  @Get()
  findAll() {
    return this.coursesService.findAll();
  }

  // @ResponseMessage('Courses fetched successfully')
  // // @Public()
  // @Get()
  // findAll(@CurrentUser() user: AuthUser) {
  //   return { user };
  // }
}
