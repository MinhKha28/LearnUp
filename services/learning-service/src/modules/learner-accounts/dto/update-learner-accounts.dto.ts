import { PartialType } from '@nestjs/swagger';
import { CreateLearnerAccountDto } from './create-learner-accounts.dto';

export class UpdateLearnerAccountDto extends PartialType(CreateLearnerAccountDto) {}
