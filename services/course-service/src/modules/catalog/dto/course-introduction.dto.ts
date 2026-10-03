import { ApiProperty } from '@nestjs/swagger';

export class IntroductionLessonDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ minimum: 1 })
  position!: number;

  @ApiProperty({ description: 'Có ít nhất 1 học liệu bắt buộc còn hiệu lực' })
  isRequired!: boolean;

  @ApiProperty({ description: 'Số học liệu còn hiệu lực' })
  materialCount!: number;
}

export class IntroductionModuleDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ minimum: 1 })
  position!: number;

  @ApiProperty({ description: 'Có ít nhất 1 Lesson bắt buộc (BR-147)' })
  isRequired!: boolean;

  @ApiProperty({ type: [IntroductionLessonDto] })
  lessons!: IntroductionLessonDto[];
}

export class CourseIntroductionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  shortDescription!: string | null;

  @ApiProperty({ type: String, nullable: true })
  trainingObjectives!: string | null;

  @ApiProperty({ type: [String] })
  learningOutcomes!: string[];

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  coverFileId!: string | null;

  @ApiProperty({ minimum: 1, maximum: 365 })
  expectedCompletionDays!: number;

  @ApiProperty({ type: Number, nullable: true })
  estimatedDurationMinutes!: number | null;

  @ApiProperty({ description: 'Tổng số học liệu bắt buộc còn hiệu lực' })
  requiredMaterialCount!: number;

  @ApiProperty({ type: [IntroductionModuleDto] })
  modules!: IntroductionModuleDto[];
}
