import { PartialType } from '@nestjs/swagger';
import { CreateSubmissionDto } from './create-submissions.dto';

export class UpdateSubmissionDto extends PartialType(CreateSubmissionDto) {}
