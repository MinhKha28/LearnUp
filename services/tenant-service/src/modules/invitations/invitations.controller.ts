import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public, ResponseMessage } from '../../common/decorator/customize';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { InvitationsService } from './invitations.service';

// Người được mời chưa có mật khẩu nên chưa đăng nhập được → mọi route đều @Public().
@ApiTags('UC04 - Invitations')
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Public()
  @Post('accept')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Kích hoạt tài khoản thành công')
  accept(@Body() dto: AcceptInvitationDto) {
    return this.invitationsService.accept(dto);
  }

  @Public()
  @Get(':token')
  @ResponseMessage('Lấy thông tin lời mời thành công')
  getInvitation(@Param('token') token: string) {
    return this.invitationsService.getInvitation(token);
  }
}
