import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsUUID,
} from 'class-validator';

export class DisplayNamesDto {
  @ApiProperty({ type: [String], maxItems: 200 })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  userIds!: string[];
}
