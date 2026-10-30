import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsString, Length, Max, Min } from 'class-validator';

export class CreateSubscriptionPlanDto {
  @ApiProperty({ example: 'Growth' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @IsString()
  @Length(1, 100, { message: 'Tên gói từ 1 đến 100 ký tự' })
  name!: string;

  @ApiProperty({ example: 4990000, description: 'Giá (VND), số nguyên' })
  @IsInt({ message: 'Giá phải là số nguyên' })
  @Min(0)
  @Max(1_000_000_000_000)
  price!: number;

  @ApiProperty({ example: 180 })
  @IsInt()
  @Min(1)
  @Max(3650)
  durationDays!: number;

  @ApiProperty({ example: 500 })
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  maxLearners!: number;

  @ApiProperty({ example: 25 })
  @IsInt()
  @Min(1)
  @Max(100_000)
  maxInstructors!: number;

  @ApiProperty({ example: 50, description: 'Đếm theo chuỗi phiên bản (BR-1)' })
  @IsInt()
  @Min(1)
  @Max(100_000)
  maxCourseChains!: number;

  @ApiProperty({ example: 128849018880, description: 'Dung lượng (byte)' })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  maxStorageBytes!: number;
}
