import { PartialType } from '@nestjs/swagger';
import { CreateCourseChainDto } from './create-course-chains.dto';

export class UpdateCourseChainDto extends PartialType(CreateCourseChainDto) {}
