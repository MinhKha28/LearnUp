import type { CurrentUser } from '@learnup/ts-common';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ResponseMessage, Roles, User } from '../../common/decorator/customize';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('UC10 - Subscription')
@UseGuards(RolesGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Roles('ORGANIZER')
  @Get('current')
  @ResponseMessage('Lấy thông tin Subscription thành công')
  getCurrent(@User() user: CurrentUser) {
    return this.subscriptionsService.getOverview(user);
  }

  @Roles('INSTRUCTOR')
  @Get('internal/instructor-material-upload-policy')
  @ResponseMessage('Material upload policy retrieved successfully')
  getInstructorMaterialUploadPolicy(@User() user: CurrentUser) {
    return this.subscriptionsService.getInstructorMaterialUploadPolicy(user);
  }
}
