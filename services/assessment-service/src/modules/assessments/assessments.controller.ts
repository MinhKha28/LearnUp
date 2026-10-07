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
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import type { CurrentUser } from '@learnup/ts-common';
import { ResponseMessage, User } from '../../common/decorator/customize';
import {
  AssessmentsService,
  PROMPT_FILE_MAX_BYTES,
} from './assessments.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';

@ApiTags('UC19 / UC19.1 / UC19.2 / UC19.3 / UC19.4 - Assignments')
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

  /** UC19.2 / UC19.3 — Upload the prompt file (one PDF, BR-320). Send it as multipart field "file". */
  @Post('assignments/prompt-file')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Prompt file uploaded successfully.')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { files: 1, fileSize: PROMPT_FILE_MAX_BYTES },
    }),
  )
  uploadPromptFile(
    @User() user: CurrentUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.service.uploadPromptFile(user, file);
  }

  /** UC19.1 — Download the prompt file of an Assignment */
  @Get('assignments/:id/prompt-file')
  async downloadPromptFile(
    @User() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { content, fileName, mimeType } =
      await this.service.downloadPromptFile(user, id);
    // Sent as a raw file, so it is not wrapped like the JSON answers.
    res
      .type(mimeType)
      .set(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      )
      .send(content);
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
