import { PartialType } from '@nestjs/swagger';
import { CreateSubscriptionDto } from './create-subscriptions.dto';

export class UpdateSubscriptionDto extends PartialType(CreateSubscriptionDto) {}
