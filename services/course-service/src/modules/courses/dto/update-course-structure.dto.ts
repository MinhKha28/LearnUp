import { Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class StructureLessonDto {
  @IsUUID()
  id!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;
}

export class StructureModuleDto {
  @IsUUID()
  id!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsDefined()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StructureLessonDto)
  lessons!: StructureLessonDto[];
}

export class UpdateCourseStructureDto {
  @IsDefined()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StructureModuleDto)
  modules!: StructureModuleDto[];
}
