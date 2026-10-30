import type { CurrentUser } from '@learnup/ts-common';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ResponseMessage, Roles, User } from '../../common/decorator/customize';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RenewSubscriptionDto } from './dto/renew-subscription.dto';
import { SubscriptionRenewalsService } from './subscription-renewals.service';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('UC10 / UC10.1 - Subscription')
@UseGuards(RolesGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly renewalsService: SubscriptionRenewalsService,
  ) {}

  @Roles('ORGANIZER')
  @Get('current')
  @ResponseMessage('Lấy thông tin Subscription thành công')
  getCurrent(@User() user: CurrentUser) {
    return this.subscriptionsService.getOverview(user);
  }

  @Roles('ORGANIZER')
  @Get('renewal-quote')
  @ResponseMessage('Lấy thông tin gia hạn thành công')
  getRenewalQuote(@User() user: CurrentUser) {
    return this.renewalsService.getQuote(user);
  }

  @Roles('ORGANIZER')
  @Post('renewals')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Đã xử lý thanh toán gia hạn')
  renew(@User() user: CurrentUser, @Body() dto: RenewSubscriptionDto) {
    return this.renewalsService.renew(user, dto);
  }

  @Roles('INSTRUCTOR')
  @Get('internal/instructor-material-upload-policy')
  @ResponseMessage('Material upload policy retrieved successfully')
  getInstructorMaterialUploadPolicy(@User() user: CurrentUser) {
    return this.subscriptionsService.getInstructorMaterialUploadPolicy(user);
  }
}
