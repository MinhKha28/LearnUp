import type { CurrentUser } from '@learnup/ts-common';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ResponseMessage, Roles, User } from '../../common/decorator/customize';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateAccountDto } from './dto/create-account.dto';
import { ListAccountsQueryDto } from './dto/list-accounts-query.dto';
import { ListDepartmentsQueryDto } from './dto/list-departments-query.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { UsersService } from './users.service';
import { GetUsersBatchDto } from './dto/get-users-batch.dto';

@ApiTags('Users') // UC12, UC12.1, UC12.2, UC12.3, UC13, UC13.1, UC13.2
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

  // UC12.1 - đặt SAU instructors/seats. id sai định dạng -> 400 (ParseUUIDPipe).
  @Roles('ORGANIZER')
  @Get('instructors/:id')
  @ResponseMessage('Lấy chi tiết Instructor thành công')
  findInstructorDetail(
    @User() user: CurrentUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.findInstructorDetail(user, id);
  }

  // UC12.2
  @Roles('ORGANIZER')
  @Post('instructors')
  @ResponseMessage('Tạo tài khoản Instructor thành công')
  createInstructor(@User() user: CurrentUser, @Body() dto: CreateAccountDto) {
    return this.service.createInstructor(user, dto);
  }

  // UC12.3 - id sai định dạng -> 400 (ParseUUIDPipe), như UC12.1.
  @Roles('ORGANIZER')
  @Patch('instructors/:id')
  @ResponseMessage('Cập nhật thông tin Instructor thành công')
  updateInstructor(
    @User() user: CurrentUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.service.updateInstructor(user, id, dto);
  }

  // UC12.3 - BR-279: gợi ý đơn vị công tác đã có trong tổ chức.
  @Roles('ORGANIZER')
  @Get('departments')
  @ResponseMessage('Lấy gợi ý đơn vị công tác thành công')
  suggestDepartments(
    @User() user: CurrentUser,
    @Query() query: ListDepartmentsQueryDto,
  ) {
    return this.service.suggestDepartments(user, query);
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

  // UC13.1 - đặt SAU learners/seats. id sai định dạng -> 400 (ParseUUIDPipe).
  @Roles('ORGANIZER')
  @Get('learners/:id')
  @ResponseMessage('Lấy chi tiết Learner thành công')
  findLearnerDetail(
    @User() user: CurrentUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.findLearnerDetail(user, id);
  }

  // UC13.2
  @Roles('ORGANIZER')
  @Post('learners')
  @ResponseMessage('Tạo tài khoản Learner thành công')
  createLearner(@User() user: CurrentUser, @Body() dto: CreateAccountDto) {
    return this.service.createLearner(user, dto);
  }
}
