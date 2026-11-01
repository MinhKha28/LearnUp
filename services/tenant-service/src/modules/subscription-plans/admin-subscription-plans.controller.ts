import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ResponseMessage, Roles } from '../../common/decorator/customize';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plans.dto';
import { SubscriptionPlansService } from './subscription-plans.service';

@ApiTags('UC43 / UC43.1 - Admin Subscription Plans')
@ApiSecurity('internal-key')
@UseGuards(RolesGuard)
@Roles('ADMIN')
@Controller('admin/subscription-plans')
export class AdminSubscriptionPlansController {
  constructor(private readonly plansService: SubscriptionPlansService) {}

  @Get()
  @ResponseMessage('Lấy danh sách Subscription Plan thành công')
  findAll() {
    return this.plansService.findAllForAdmin();
  }

  @Post()
  @ResponseMessage('Tạo Subscription Plan thành công')
  create(@Body() dto: CreateSubscriptionPlanDto) {
    return this.plansService.create(dto);
  }
}
