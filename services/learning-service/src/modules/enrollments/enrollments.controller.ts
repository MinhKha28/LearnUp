import type { CurrentUser } from '@learnup/ts-common';
import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  HttpCode,
  Param,
} from '@nestjs/common';
import { ApiBadRequestResponse, ApiQuery } from '@nestjs/swagger';
import {
  MY_ENROLLMENT_STATUSES,
  MY_ENROLLMENT_TYPES,
  parseMyEnrollmentFilters,
} from './my-enrollment-filters';
import { EnrollmentWithdrawalService } from './enrollment-withdrawal.service';
import { EnrollmentRateLimitGuard } from './enrollment-rate-limit.guard';
import { ResponseMessage, User } from '../../common/decorator/customize';
import { Roles } from '../../common/decorator/roles.decorator';
import { ParsePagePipe } from '../../common/pipes/parse-page.pipe';
import { CreateEnrollmentDto } from './dto/create-enrollments.dto';
import type {
  CreatedEnrollment,
  EnrolledCourseRef,
} from './enrollments.repository';
import {
  EnrollmentsService,
  type MyEnrollmentsPage,
} from './enrollments.service';
import { GetCourseLearnerCountsDto } from './dto/get-course-learner-counts.dto';

@Controller('enrollments')
export class EnrollmentsController {
  constructor(
    private readonly service: EnrollmentsService,
    private readonly withdrawal: EnrollmentWithdrawalService,
  ) {}

  @Post(':enrollmentId/withdrawal')
  @HttpCode(200)
  @Roles('LEARNER')
  withdraw(@User() user: CurrentUser, @Param('enrollmentId') id: string) {
    return this.withdrawal.withdraw(user, id);
  }

  /** UC25.3: tự đăng ký Course tự chọn. */
  @Post()
  @UseGuards(EnrollmentRateLimitGuard)
  @Roles('LEARNER')
  @ResponseMessage('Đăng ký Course thành công')
  enroll(
    @User() user: CurrentUser,
    @Body() dto: CreateEnrollmentDto,
  ): Promise<CreatedEnrollment & { restored: boolean }> {
    return this.service.enrollOptional(user, dto.courseId);
  }

  /** D20, D48: Course đã đăng ký kèm enrollmentId, để gắn nhãn (D5) và nút "Vào học" mở UC27. */
  @Get('me/course-ids')
  @Roles('LEARNER')
  getMyCourseIds(@User() user: CurrentUser): Promise<EnrolledCourseRef[]> {
    return this.service.getMyCourseIds(user);
  }

  @Get('me')
  @Roles('LEARNER')
  @ApiQuery({
    name: 'q',
    required: false,
    schema: { type: 'string' },
    description:
      'Course name substring. Trimmed before enforcing the 200-character limit.',
  })
  @ApiQuery({ name: 'type', required: false, enum: MY_ENROLLMENT_TYPES })
  @ApiQuery({ name: 'status', required: false, enum: MY_ENROLLMENT_STATUSES })
  @ApiBadRequestResponse({
    description:
      'VALIDATION_ERROR: invalid page, invalid filter, or repeated filter.',
  })
  findMine(
    @User() user: CurrentUser,
    @Query('page', ParsePagePipe) page: number,
    @Query('q') q?: unknown,
    @Query('type') type?: unknown,
    @Query('status') status?: unknown,
  ): Promise<MyEnrollmentsPage> {
    return this.service.findMyEnrollments(
      user,
      page,
      parseMyEnrollmentFilters(q, type, status),
    );
  }

  @Post('learner-counts')
  @ResponseMessage('Course learner counts fetched successfully')
  getCourseLearnerCounts(
    @User() user: CurrentUser,
    @Body() dto: GetCourseLearnerCountsDto,
  ) {
    return this.service.getCourseLearnerCounts(user, dto.courseIds);
  }
}
