import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { normalizeText } from '../../../common/utils/text.util';

// BR-279: gợi ý đơn vị công tác đã có trong tổ chức khi nhập (UC12.3).
export class ListDepartmentsQueryDto {
  // Khớp một phần, không phân biệt hoa thường; rỗng sau chuẩn hóa -> không lọc.
  @ApiPropertyOptional({ example: 'kỹ thuật', maxLength: 100 })
  @Transform(({ value }) => {
    const normalized = normalizeText(value);
    return normalized === '' ? undefined : normalized;
  })
  @IsOptional()
  @IsString({ message: 'keyword phải là chuỗi' })
  @MaxLength(100, { message: 'keyword tối đa 100 ký tự' })
  keyword?: string;
}
