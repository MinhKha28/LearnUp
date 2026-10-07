import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  normalizeEmail,
  normalizePhone,
  normalizeTaxCode,
  normalizeText,
} from '../../../common/utils/text.util';

// @Transform chạy TRƯỚC khi kiểm tra (vì main.ts bật transform: true),
// nên độ dài được đo sau khi chuẩn hóa NFC + cắt khoảng trắng.
// Độ dài tối đa khớp với @db.VarChar trong prisma/schema.prisma.

export class OrganizationInfoDto {
  @ApiProperty({ example: 'Công ty ABC' })
  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ example: '0312345678', description: '10 hoặc 13 chữ số' })
  @Transform(({ value }) => normalizeTaxCode(value))
  @IsString()
  @Matches(/^[0-9]{10}([0-9]{3})?$/, {
    message: 'Mã số thuế phải gồm 10 hoặc 13 chữ số',
  })
  taxCode!: string;

  @ApiProperty({ example: '123 Nguyễn Huệ, Quận 1, TP.HCM' })
  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  address!: string;

  @ApiProperty({ example: '0901234567', description: 'Lưu dạng +84901234567' })
  @Transform(({ value }) => normalizePhone(value))
  @IsString()
  @Matches(/^\+[1-9][0-9]{1,14}$/, { message: 'Số điện thoại không hợp lệ' })
  contactPhone!: string;

  @ApiPropertyOptional({ example: 'contact@abc.vn' })
  @IsOptional()
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail({}, { message: 'Email liên hệ không hợp lệ' })
  @MaxLength(254)
  contactEmail?: string;
}

export class OrganizerAccountDto {
  @ApiProperty({ example: 'Nguyễn Thị Lan' })
  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fullName!: string;

  @ApiProperty({ example: 'lan@abc.vn' })
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'Matkhau@123', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu tối thiểu 8 ký tự' })
  @MaxLength(72, { message: 'Mật khẩu tối đa 72 ký tự' }) // giới hạn của BCrypt
  password!: string;
}

export class CreateRegistrationDto {
  @ApiProperty({ description: 'id của Subscription Plan đã chọn (BR-4)' })
  @IsUUID()
  planId!: string;

  @ApiProperty({ type: OrganizationInfoDto })
  @ValidateNested()
  @Type(() => OrganizationInfoDto)
  organization!: OrganizationInfoDto;

  @ApiProperty({ type: OrganizerAccountDto })
  @ValidateNested()
  @Type(() => OrganizerAccountDto)
  organizer!: OrganizerAccountDto;
}
