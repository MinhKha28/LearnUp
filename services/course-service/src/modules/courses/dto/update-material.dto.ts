import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateMaterialDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Matches(/\S/, {
    message: 'Material title cannot be empty.',
  })
  title?: string;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}
