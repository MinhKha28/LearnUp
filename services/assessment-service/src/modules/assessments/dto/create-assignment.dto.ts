import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Trim } from '../../../common/decorator/customize';
import { CreateRubricDto } from '../../rubrics/dto/create-rubrics.dto';

/** Metadata of the single prompt attachment already stored by Media Storage (BR-320). */
export class PromptFileDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fileKey!: string;

  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  mimeType!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  sizeBytes!: number;
}

/**
 * UC19.2 — there is deliberately no `isRequired`, deadline or peer-review field:
 * Assignments are never optional (BR-165), have no own deadline (BR-166) and peer
 * review is switched on later through UC19.5.
 */
export class CreateAssignmentDto {
  @ApiProperty()
  @IsUUID()
  courseId!: string;

  @ApiProperty({ maxLength: 200 })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({
    maxLength: 8000,
    description: 'Assignment prompt text',
  })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  prompt?: string;

  @ApiPropertyOptional({ type: PromptFileDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PromptFileDto)
  promptFile?: PromptFileDto | null;

  /** BR-315 scale: 0–100, 2 decimals. */
  @ApiProperty({ minimum: 0, maximum: 100 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  passingScore!: number;

  /** BR-174: stored in minutes. The upper bounds below are not in the rules: they only keep the value inside a sane range (and the column). */
  @ApiProperty({ minimum: 1, maximum: 100000 })
  @IsInt()
  @Min(1)
  @Max(100000)
  expectedDurationMinutes!: number;

  /** n — defaults to the platform parameter when omitted (BR-175). */
  @ApiPropertyOptional({ minimum: 1, maximum: 1000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  maxConsecutiveAttempts?: number;

  /** m hours — defaults to the platform parameter when omitted (BR-175). */
  @ApiPropertyOptional({ minimum: 1, maximum: 8760 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8760)
  lockoutHours?: number;

  /** BR-164: Rubric is mandatory for every Assignment; UC19.2 step 3: 1-10 criteria. */
  @ApiProperty({ type: [CreateRubricDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => CreateRubricDto)
  rubric!: CreateRubricDto[];
}
