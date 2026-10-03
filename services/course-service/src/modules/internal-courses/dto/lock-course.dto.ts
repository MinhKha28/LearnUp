import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class LockCourseDto {
  @ApiProperty({
    description:
      'true khi Learner tự đăng ký (UC25.3): Course phải là Public (BR-62)',
  })
  @IsBoolean()
  selfEnroll!: boolean;
}
