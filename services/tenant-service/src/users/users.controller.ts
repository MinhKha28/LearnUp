import type { CurrentUser } from '@learnup/ts-common';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ResponseMessage, Roles, User } from '../common/decorator/customize';
import { RolesGuard } from '../common/guards/roles.guard';
import { ListAccountsQueryDto } from './dto/list-accounts-query.dto';
import { UsersService } from './users.service';

@ApiTags('UC12 - Users')
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
}
