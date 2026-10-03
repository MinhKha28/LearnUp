import { PartialType } from '@nestjs/swagger';
import { CreateSubscriptionPlanDto } from './create-subscription-plans.dto';

export class UpdateSubscriptionPlanDto extends PartialType(CreateSubscriptionPlanDto) {}
