import { Controller } from '@nestjs/common';
import { QuotaLocksService } from './quota-locks.service';

@Controller('quota-locks')
export class QuotaLocksController {
  constructor(private readonly service: QuotaLocksService) {}
}
