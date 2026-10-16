import type { CurrentUser } from '@learnup/ts-common';
import { Body, Controller, Post } from '@nestjs/common';
import { User, ResponseMessage } from '../../common/decorator/customize';
import { Roles } from '../../common/decorator/roles.decorator';
import { AssignmentsService } from './assignments.service';
import { CreateAssignmentDto } from './create-assignment.dto';

@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly service: AssignmentsService) {}

  @Post()
  @Roles('ORGANIZER')
  @ResponseMessage('Phân công Course thành công')
  assign(@User() user: CurrentUser, @Body() dto: CreateAssignmentDto) {
    return this.service.assign(user, dto);
  }
}
