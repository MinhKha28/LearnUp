import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import type { CurrentUser } from '@learnup/ts-common';
import { ResponseMessage, User } from '../common/decorator/customize';
import { AssessmentsService } from './assessments.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';

@ApiTags('assessments')
@ApiSecurity('internal-key')
@Controller('assessments')
export class AssessmentsController {
  constructor(private readonly service: AssessmentsService) {}

  /** UC19 — List Assignments of a Course */
  @Get('assignments')
  @ResponseMessage('Assignments retrieved successfully.')
  listAssignments(
    @User() user: CurrentUser,
    @Query('courseId', ParseUUIDPipe) courseId: string,
  ) {
    return this.service.listAssignments(user, courseId);
  }

  /** UC19.1 — View Assignment detail */
  @Get('assignments/:id')
  @ResponseMessage('Assignment retrieved successfully.')
  getAssignment(
    @User() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getAssignment(user, id);
  }

  /** UC19.3 — Update Assignment */
  @Patch('assignments/:id')
  @ResponseMessage('Assignment updated successfully.')
  updateAssignment(
    @User() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssignmentDto,
  ) {
    return this.service.updateAssignment(user, id, dto);
  }

  /** UC19.4 — Delete Assignment */
  @Delete('assignments/:id')
  @ResponseMessage('Assignment deleted successfully.')
  deleteAssignment(
    @User() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.deleteAssignment(user, id);
  }

  /** UC19.2 — Create Assignment */
  @Post('assignments')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Assignment created successfully.')
  createAssignment(
    @User() user: CurrentUser,
    @Body() dto: CreateAssignmentDto,
  ) {
    return this.service.createAssignment(user, dto);
  }
}
