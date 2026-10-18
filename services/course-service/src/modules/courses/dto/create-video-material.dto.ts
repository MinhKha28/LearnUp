import { Transform } from 'class-transformer';
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

  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsDefined()
  @IsBoolean()
  isRequired!: boolean;
}
