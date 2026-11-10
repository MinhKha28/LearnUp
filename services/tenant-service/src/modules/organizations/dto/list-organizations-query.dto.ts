import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, Min } from 'class-validator';

export const ORGANIZATION_PAGE_SIZE_OPTIONS = [10, 20, 50];

// UC44 - Xem danh sách Organization (Admin). Lọc theo tên, gói, trạng thái là UC44.2.
export class ListOrganizationsQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page phải là số nguyên' })
  @Min(1, { message: 'page phải lớn hơn hoặc bằng 1' })
  page: number = 1;

  @ApiPropertyOptional({ enum: ORGANIZATION_PAGE_SIZE_OPTIONS, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsIn(ORGANIZATION_PAGE_SIZE_OPTIONS, {
    message: 'pageSize phải là 10, 20 hoặc 50',
  })
  pageSize: number = 10;

  // UC44: mặc định ẩn Organization Cancelled (BR-8, BR-12); true thì hiện cả nhóm này.
  // Query string chỉ nhận "true" / "false"; giá trị khác giữ nguyên để IsBoolean báo lỗi.
  @ApiPropertyOptional({ type: Boolean, default: false })
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsOptional()
  @IsBoolean({ message: 'includeCancelled phải là true hoặc false' })
  includeCancelled: boolean = false;
}
