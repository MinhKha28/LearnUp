import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public, ResponseMessage } from '../../common/decorator/customize';
import { SubscriptionPlansService } from './subscription-plans.service';

@ApiTags('UC01 - Subscription Plans')
@Controller('subscription-plans')
export class SubscriptionPlansController {
  constructor(private readonly plansService: SubscriptionPlansService) {}

  @Public()
  @Get()
  @ResponseMessage('Lấy danh sách Subscription Plan thành công')
  findOffered() {
    return this.plansService.findOffered();
  }
}
