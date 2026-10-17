import type { CurrentUser } from '@learnup/ts-common';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiSecurity, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ResponseMessage, User } from '../../common/decorator/customize';
import { SubmitAssignmentDto } from './dto/submit-assignment.dto';
import { SUBMISSION_FILE_MAX_BYTES } from './learner-submissions.constants';
import { LearnerSubmissionsService } from './learner-submissions.service';

@ApiTags('UC30 / UC30.1 / UC30.2 - Learner submissions')
@ApiSecurity('internal-key')
@Controller('assessments/learner/assignments')
export class LearnerSubmissionsController {
  constructor(private readonly service: LearnerSubmissionsService) {}

  /** UC30 step 1 — the Assignment as the Learner reads it (prompt, Rubric, attempts left). */
  @Get(':id')
  @ResponseMessage('Assignment retrieved successfully.')
  getAssignment(
    @User() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getAssignment(user, id);
  }

  /** UC30.2 - View Grading Results of a Finalized submission. */
  @Get(':id/submissions/:submissionId/result')
  @ResponseMessage('Grading result retrieved successfully.')
  getResult(
    @User() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
  ) {
    return this.service.getResult(user, id, submissionId);
  }

  /** The prompt file of the Assignment. */
  @Get(':id/prompt-file')
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

  /** UC30 — Submit Assignment. Multipart: text field "content" and/or one file in the field "file". */
  @Post(':id/submissions')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Assignment submitted successfully.')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { files: 1, fileSize: SUBMISSION_FILE_MAX_BYTES },
    }),
  )
  submit(
    @User() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitAssignmentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.service.submit(user, id, dto, file);
  }

  /** UC30.1 - Resubmit Assignment. Same multipart body as UC30; replaces the previous submission. */
  @Post(':id/resubmissions')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('Assignment resubmitted successfully.')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { files: 1, fileSize: SUBMISSION_FILE_MAX_BYTES },
    }),
  )
  resubmit(
    @User() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitAssignmentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.service.resubmit(user, id, dto, file);
  }
}
