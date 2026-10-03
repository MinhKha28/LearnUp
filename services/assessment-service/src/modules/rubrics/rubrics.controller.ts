import { Controller } from '@nestjs/common';
import { RubricsService } from './rubrics.service';

@Controller('rubrics')
export class RubricsController {
  constructor(private readonly service: RubricsService) {}
}
