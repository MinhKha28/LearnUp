import { Controller } from '@nestjs/common';
import { CompletedEnrollmentsService } from './completed-enrollments.service';

@Controller('completed-enrollments')
export class CompletedEnrollmentsController {
  constructor(private readonly service: CompletedEnrollmentsService) {}
}
