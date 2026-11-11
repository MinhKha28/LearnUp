import type { CurrentUser } from '@learnup/ts-common';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Patch,
  HttpCode,
  Query,
} from '@nestjs/common';
import { AssignmentListQueryDto } from './assignment-list-query.dto';
import { AssignmentReadsService } from './assignment-reads.service';
import { User, ResponseMessage } from '../../common/decorator/customize';
import { Roles } from '../../common/decorator/roles.decorator';
import { AssignmentsService } from './assignments.service';
import { CreateAssignmentDto } from './create-assignment.dto';
import { AssignmentChangesService } from './assignment-changes.service';
import {
  ExtendAssignmentDto,
  ExemptAssignmentDto,
  RemoveExemptionBodyPipe,
} from './change-assignment.dto';

@Controller('assignments')
export class AssignmentsController {
  constructor(
    private readonly service: AssignmentsService,
    private readonly reads: AssignmentReadsService,
    private readonly changes: AssignmentChangesService,
  ) {}

  @Get()
  @Roles('ORGANIZER')
  list(@User() user: CurrentUser, @Query() query: AssignmentListQueryDto) {
    return this.reads.list(user, query);
  }

  @Get(':enrollmentId')
  @Roles('ORGANIZER')
  detail(
    @User() user: CurrentUser,
    @Param('enrollmentId', new ParseUUIDPipe()) id: string,
  ) {
    return this.reads.detail(user, id);
  }

  @Post()
  @Roles('ORGANIZER')
  @ResponseMessage('Phân công Course thành công')
  assign(@User() user: CurrentUser, @Body() dto: CreateAssignmentDto) {
    return this.service.assign(user, dto);
  }

  @Patch(':enrollmentId/due-date')
  @Roles('ORGANIZER')
  extend(
    @User() user: CurrentUser,
    @Param('enrollmentId', new ParseUUIDPipe()) id: string,
    @Body() dto: ExtendAssignmentDto,
  ) {
    return this.changes.extend(user, id, dto);
  }

  @Post(':enrollmentId/exemption')
  @HttpCode(200)
  @Roles('ORGANIZER')
  exempt(
    @User() user: CurrentUser,
    @Param('enrollmentId', new ParseUUIDPipe()) id: string,
    @Body() dto: ExemptAssignmentDto,
  ) {
    return this.changes.exempt(user, id, dto);
  }

  @Delete(':enrollmentId/exemption')
  @Roles('ORGANIZER')
  removeExemption(
    @User() user: CurrentUser,
    @Param('enrollmentId', new ParseUUIDPipe()) id: string,
    @Body(RemoveExemptionBodyPipe) _body: void,
  ) {
    return this.changes.removeExemption(user, id);
  }
}
