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

/** One Rubric criterion (BR-164 / BR-315: max points is a whole number; UC19.2 step 3: 1-100). */
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

  @ApiProperty({ minimum: 1, maximum: 100 })
  @IsInt()
  @Min(1)
  @Max(100)
  maxPoints!: number;
}
