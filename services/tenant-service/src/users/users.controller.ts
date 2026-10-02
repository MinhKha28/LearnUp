import type { CurrentUser } from '@learnup/ts-common';
import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ResponseMessage, Roles, User } from '../common/decorator/customize';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateAccountDto } from './dto/create-account.dto';
import { ListAccountsQueryDto } from './dto/list-accounts-query.dto';
import { UsersService } from './users.service';
import { GetUsersBatchDto } from './dto/get-users-batch.dto';

@ApiTags('Users') // UC12, UC12.2, UC13, UC13.2
@ApiSecurity('internal-key')
@UseGuards(RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  // UC12
  @Roles('ORGANIZER')
  @Get('instructors')
  @ResponseMessage('Lấy danh sách Instructor thành công')
  findInstructors(
    @User() user: CurrentUser,
    @Query() query: ListAccountsQueryDto,
  ) {
    return this.service.findInstructors(user, query);
  }

  // UC12.2 - số chỗ Instructor. Giữ TRƯỚC mọi route dạng instructors/:id (UC12.1…),
  // nếu không "seats" sẽ bị hiểu là :id.
  @Roles('ORGANIZER')
  @Get('instructors/seats')
  @ResponseMessage('Lấy số chỗ Instructor thành công')
  getInstructorSeats(@User() user: CurrentUser) {
    return this.service.getInstructorSeats(user);
  }

  // UC12.2
  @Roles('ORGANIZER')
  @Post('instructors')
  @ResponseMessage('Tạo tài khoản Instructor thành công')
  createInstructor(@User() user: CurrentUser, @Body() dto: CreateAccountDto) {
    return this.service.createInstructor(user, dto);
  }

  // UC13
  @Roles('ORGANIZER')
  @Get('learners')
  @ResponseMessage('Lấy danh sách Learner thành công')
  findLearners(
    @User() user: CurrentUser,
    @Query() query: ListAccountsQueryDto,
  ) {
    return this.service.findLearners(user, query);
  }

  @Post('batch')
  @ResponseMessage('Users fetched successfully')
  findBatch(@User() user: CurrentUser, @Body() dto: GetUsersBatchDto) {
    return this.service.findBatch(user, dto.userIds);
  }
  // UC13.2 - số chỗ Learner. Giữ TRƯỚC mọi route dạng learners/:id (UC13.1…),
  // nếu không "seats" sẽ bị hiểu là :id.
  @Roles('ORGANIZER')
  @Get('learners/seats')
  @ResponseMessage('Lấy số chỗ Learner thành công')
  getLearnerSeats(@User() user: CurrentUser) {
    return this.service.getLearnerSeats(user);
  }

  // UC13.2
  @Roles('ORGANIZER')
  @Post('learners')
  @ResponseMessage('Tạo tài khoản Learner thành công')
  createLearner(@User() user: CurrentUser, @Body() dto: CreateAccountDto) {
    return this.service.createLearner(user, dto);
  }
}
