import { ApiProperty } from '@nestjs/swagger';
import { Trim } from '../../../common/decorator/customize';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** One Rubric criterion (BR-164 / BR-315: max points is a positive integer). */
export class CreateRubricDto {
  @ApiProperty({ maxLength: 200 })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ maxLength: 500 })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  @Max(1000)
  maxPoints!: number;
}
