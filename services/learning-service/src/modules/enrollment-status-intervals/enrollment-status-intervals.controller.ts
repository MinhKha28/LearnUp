import { Controller } from '@nestjs/common';
import { EnrollmentStatusIntervalsService } from './enrollment-status-intervals.service';

@Controller('enrollment-status-intervals')
export class EnrollmentStatusIntervalsController {
  constructor(private readonly service: EnrollmentStatusIntervalsService) {}
}
