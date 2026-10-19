import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateReadingMaterialDto {
  @IsDefined()
  @IsString()
  @MaxLength(200)
  @Matches(/\S/, {
    message: 'Reading title cannot be empty.',
  })
  title!: string;

  @Transform(({ value }: TransformFnParams) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsDefined()
  @IsBoolean()
  isRequired!: boolean;
}
