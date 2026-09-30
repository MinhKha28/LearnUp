import { PartialType } from '@nestjs/swagger';
import { CreateMediaFileDto } from './create-media-files.dto';

export class UpdateMediaFileDto extends PartialType(CreateMediaFileDto) {}
