import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

// Trường chữ đi kèm tệp trong multipart của bước confirm.
// previewDigest lấy từ kết quả preview: server tính lại trên dữ liệu hiện tại, khác thì trả IMPORT_CHANGED.
export class ConfirmMemberImportDto {
  @ApiProperty({
    description: 'previewDigest nhận được ở bước preview',
    example: '3f2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b',
  })
  @IsString({ message: 'previewDigest phải là chuỗi' })
  @Matches(/^[0-9a-f]{64}$/, { message: 'previewDigest không hợp lệ' })
  previewDigest!: string;
}
