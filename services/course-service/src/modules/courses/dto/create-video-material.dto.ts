import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateVideoMaterialDto {
  @IsDefined()
  @IsString()
  @MaxLength(200)
  @Matches(/\S/, {
    message: 'Video title cannot be empty.',
  })
  title!: string;

  @Transform(({ value }: TransformFnParams): unknown => {
    const rawValue: unknown = value;

    if (rawValue === 'true') return true;
    if (rawValue === 'false') return false;

    return rawValue;
  })
  @IsDefined()
  @IsBoolean()
  isRequired!: boolean;
}
