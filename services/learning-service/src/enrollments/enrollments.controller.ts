import type { CurrentUser } from '@learnup/ts-common';
import { Body, Controller, Get, Post } from '@nestjs/common';
import { ResponseMessage, User } from '../common/decorator/customize';
import { Roles } from '../common/decorator/roles.decorator';
import { CreateEnrollmentDto } from './dto/create-enrollments.dto';
import type { CreatedEnrollment } from './enrollments.repository';
import { EnrollmentsService } from './enrollments.service';

@Controller('enrollments')
export class EnrollmentsController {
  constructor(private readonly service: EnrollmentsService) {}

  /** UC25.3: tự đăng ký Course tự chọn. */
  @Post()
  @Roles('LEARNER')
  @ResponseMessage('Đăng ký Course thành công')
  enroll(
    @User() user: CurrentUser,
    @Body() dto: CreateEnrollmentDto,
  ): Promise<CreatedEnrollment> {
    return this.service.enrollOptional(user, dto.courseId);
  }

  /** D20: courseId đã đăng ký, để danh mục gắn nhãn (D5). */
  @Get('me/course-ids')
  @Roles('LEARNER')
  getMyCourseIds(@User() user: CurrentUser): Promise<string[]> {
    return this.service.getMyCourseIds(user);
  }
}
