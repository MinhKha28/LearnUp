import { Controller } from '@nestjs/common';
import { CourseChainsService } from './course-chains.service';

@Controller('course-chains')
export class CourseChainsController {
  constructor(private readonly service: CourseChainsService) {}
}
