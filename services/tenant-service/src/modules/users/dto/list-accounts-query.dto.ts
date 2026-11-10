import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { UserStatus } from '../../../common/constants/tenant.constants';
import { normalizeText } from '../../../common/utils/text.util';

export const PAGE_SIZE_OPTIONS = [10, 20, 50];

const USER_STATUSES = Object.values(UserStatus);
type UserStatusValue = (typeof UserStatus)[keyof typeof UserStatus];

// Query chung cho danh sách tài khoản trong tổ chức (UC12 Instructor, UC13 Learner).
// keyword, status (UC12.4 / UC13.4) là tùy chọn, không phá API cũ.
export class ListAccountsQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page phải là số nguyên' })
  @Min(1, { message: 'page phải lớn hơn hoặc bằng 1' })
  page: number = 1;

  @ApiPropertyOptional({ enum: PAGE_SIZE_OPTIONS, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsIn(PAGE_SIZE_OPTIONS, { message: 'pageSize phải là 10, 20 hoặc 50' })
  pageSize: number = 10;

  // UC12.4 / UC13.4: khớp một phần họ tên hoặc email, không phân biệt hoa thường.
  // BR-279: chuẩn hóa khoảng trắng như dữ liệu nhập tự do; rỗng sau chuẩn hóa -> không lọc.
  @ApiPropertyOptional({ example: 'nguyen', maxLength: 100 })
  @Transform(({ value }) => {
    const normalized = normalizeText(value);
    return normalized === '' ? undefined : normalized;
  })
  @IsOptional()
  @IsString({ message: 'keyword phải là chuỗi' })
  @MaxLength(100, { message: 'keyword tối đa 100 ký tự' })
  keyword?: string;

  // UC12.4 / UC13.4. BR-36: tài khoản Deactivated vẫn nằm trong danh sách nên lọc được.
  @ApiPropertyOptional({ enum: USER_STATUSES })
  @IsOptional()
  @IsIn(USER_STATUSES, {
    message: 'status phải là Pending, Active hoặc Deactivated',
  })
  status?: UserStatusValue;
}
