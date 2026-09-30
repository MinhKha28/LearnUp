import { PartialType } from '@nestjs/swagger';
import { CreateMaterialProgressDto } from './create-material-progress.dto';

export class UpdateMaterialProgressDto extends PartialType(CreateMaterialProgressDto) {}
