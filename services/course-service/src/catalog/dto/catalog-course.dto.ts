import { ApiProperty } from '@nestjs/swagger';

export class CatalogCourseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  shortDescription!: string | null;

  @ApiProperty({ type: String, nullable: true })
  trainingObjectives!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  coverFileId!: string | null;

  @ApiProperty({ minimum: 1, maximum: 365 })
  expectedCompletionDays!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Phút; null khi chưa tính được (platform_settings trống)',
  })
  estimatedDurationMinutes!: number | null;
}
