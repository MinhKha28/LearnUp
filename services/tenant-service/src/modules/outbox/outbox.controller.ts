import { Controller } from '@nestjs/common';
import { OutboxService } from './outbox.service';

@Controller('outbox')
export class OutboxController {
  constructor(private readonly service: OutboxService) {}
}
