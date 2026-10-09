import type { CurrentUser } from '@learnup/ts-common';
import {
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
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ResponseMessage, User } from '../../common/decorator/customize';
import { PROMPT_FILE_MAX_BYTES } from './assignment-media.constants';
import { AssignmentMediaService } from './assignment-media.service';
import { AssessmentsService } from './assessments.service';

@ApiTags('UC19.1 / UC19.2 / UC19.3 - Assignment prompt file')
@ApiSecurity('internal-key')
@Controller('assessments')
export class AssignmentMediaController {
  constructor(
    private readonly mediaService: AssignmentMediaService,
    private readonly assessmentsService: AssessmentsService,
  ) {}

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
    return this.mediaService.uploadPromptFile(user, file);
  }

  /** UC19.1 — Download the prompt file of an Assignment */
  @Get('assignments/:id/prompt-file')
  async downloadPromptFile(
    @User() user: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { content, fileName, mimeType } =
      await this.assessmentsService.downloadPromptFile(user, id);
    // Sent as a raw file, so it is not wrapped like the JSON answers.
    res
      .type(mimeType)
      .set(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      )
      .send(content);
  }
}
