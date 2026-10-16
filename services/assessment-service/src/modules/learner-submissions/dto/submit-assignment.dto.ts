import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../../common/decorator/customize';
import { SUBMISSION_CONTENT_MAX_LENGTH } from '../learner-submissions.constants';

/** The text part of the multipart body of UC30; the attachment travels in the multipart field "file". */
export class SubmitAssignmentDto {
  @ApiPropertyOptional({ maxLength: SUBMISSION_CONTENT_MAX_LENGTH })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(SUBMISSION_CONTENT_MAX_LENGTH)
  content?: string;
}
