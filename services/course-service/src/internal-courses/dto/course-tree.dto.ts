import { ApiProperty } from '@nestjs/swagger';

export class CourseTreeMaterialDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ minimum: 1 })
  position!: number;

  @ApiProperty({ enum: ['Video', 'Reading'] })
  materialType!: string;

  @ApiProperty()
  isRequired!: boolean;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Thời lượng video (giây); null với Reading',
  })
  durationSeconds!: number | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  disabledAt!: Date | null;
}

export class CourseTreeLessonDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ minimum: 1 })
  position!: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  disabledAt!: Date | null;

  @ApiProperty({ type: [CourseTreeMaterialDto] })
  materials!: CourseTreeMaterialDto[];
}

export class CourseTreeModuleDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ minimum: 1 })
  position!: number;

  @ApiProperty({ type: [CourseTreeLessonDto] })
  lessons!: CourseTreeLessonDto[];
}

export class CourseTreeDto {
  @ApiProperty({ format: 'uuid' })
  courseId!: string;

  @ApiProperty({ format: 'uuid' })
  chainId!: string;

  @ApiProperty()
  versionNumber!: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  disabledAt!: Date | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Thời điểm bắt đầu đọc cây',
  })
  asOf!: Date;

  @ApiProperty({ type: [CourseTreeModuleDto] })
  modules!: CourseTreeModuleDto[];
}
