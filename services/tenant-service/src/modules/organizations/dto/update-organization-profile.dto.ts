import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  normalizeEmail,
  normalizePhone,
  normalizeTaxCode,
  normalizeText,
} from '../../../common/utils/text.util';

export class UpdateOrganizationProfileDto {
  @ApiPropertyOptional({ example: 'Công ty ABC' })
  @IsOptional()
  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({
    example: '0312345678',
    description: '10 hoặc 13 chữ số',
  })
  @IsOptional()
  @Transform(({ value }) => normalizeTaxCode(value))
  @IsString()
  @Matches(/^[0-9]{10}([0-9]{3})?$/, {
    message: 'Mã số thuế phải gồm 10 hoặc 13 chữ số',
  })
  taxCode?: string;

  @ApiPropertyOptional({ example: '123 Nguyễn Huệ, Quận 1, TP.HCM' })
  @IsOptional()
  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  address?: string;

  @ApiPropertyOptional({
    example: '0901234567',
    description: 'Lưu dạng +84901234567',
  })
  @IsOptional()
  @Transform(({ value }) => normalizePhone(value))
  @IsString()
  @Matches(/^\+[1-9][0-9]{1,14}$/, { message: 'Số điện thoại không hợp lệ' })
  contactPhone?: string;

  @ApiPropertyOptional({
    example: 'contact@abc.vn',
    nullable: true,
    description: 'null để xóa email liên hệ',
  })
  @IsOptional()
  @Transform(({ value }) => (value === null ? null : normalizeEmail(value)))
  @ValidateIf((_, value) => value !== null)
  @IsEmail({}, { message: 'Email liên hệ không hợp lệ' })
  @MaxLength(254)
  contactEmail?: string | null;

  @ApiPropertyOptional({
    example: 'Asia/Ho_Chi_Minh',
    description: 'Tên múi giờ IANA (BR-55)',
  })
  @IsOptional()
  @IsString()
  timezone?: string;
}
