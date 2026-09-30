import { Controller } from '@nestjs/common';
import { SubscriptionPlansService } from './subscription-plans.service';

@Controller('subscription-plans')
export class SubscriptionPlansController {
  constructor(private readonly service: SubscriptionPlansService) {}
}
