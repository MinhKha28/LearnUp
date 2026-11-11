import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDefined,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class TransferCourseOwnershipDto {
  @ApiProperty({
    description: 'Instructor mới tiếp nhận Course Chain',
    format: 'uuid',
  })
  @IsDefined()
  @IsUUID('all')
  toInstructorId!: string;

  @ApiProperty({
    description: 'Instructor phụ trách khi Organizer mở màn hình',
    format: 'uuid',
  })
  @IsDefined()
  @IsUUID('all')
  expectedInstructorId!: string;

  @ApiPropertyOptional({
    description: 'Lý do chuyển quyền, không bắt buộc',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  reason?: string;
}
