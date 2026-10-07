import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

export const PAGE_SIZE_OPTIONS = [10, 20, 50];

// Query chung cho danh sách tài khoản trong tổ chức (UC12 Instructor, sau này UC13 Learner).
// UC12.4 / UC13.4 sẽ thêm keyword, status tại đây (tham số tùy chọn, không phá API cũ).
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
}
