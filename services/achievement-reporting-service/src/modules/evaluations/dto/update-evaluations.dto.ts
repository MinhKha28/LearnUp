import { PartialType } from '@nestjs/swagger';
import { CreateEvaluationDto } from './create-evaluations.dto';

export class UpdateEvaluationDto extends PartialType(CreateEvaluationDto) {}
