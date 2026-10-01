import { PartialType } from '@nestjs/swagger';
import { CreateRubricDto } from './create-rubrics.dto';

export class UpdateRubricDto extends PartialType(CreateRubricDto) {}
