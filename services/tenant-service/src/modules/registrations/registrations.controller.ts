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
import { CreateRegistrationDto } from './dto/create-registrations.dto';
import { RegistrationsService } from './registrations.service';
import { PayRegistrationDto } from './dto/pay-registration.dto';
import { VerifyEmailOtpDto } from './dto/verify-email-otp.dto';
import { ResendRegistrationEmailDto } from './dto/resend-registration-email.dto';

// Mọi endpoint ở đây dành cho Guest (chưa đăng nhập) nên đều @Public().
@ApiTags('UC02 / UC02.1 / UC03 / UC03.1 - Registrations')
@Controller('registrations')
export class RegistrationsController {
  constructor(private readonly registrationsService: RegistrationsService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ResponseMessage('Đã tiếp nhận đăng ký')
  create(@Body() dto: CreateRegistrationDto) {
    return this.registrationsService.create(dto);
  }

  @Public()
  @Post('payments')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Đã xử lý thanh toán')
  pay(@Body() dto: PayRegistrationDto) {
    return this.registrationsService.pay(dto);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Xác thực email thành công')
  verifyEmailOtp(@Body() dto: VerifyEmailOtpDto) {
    return this.registrationsService.verifyEmailOtp(dto);
  }

  @Public()
  @Post('resend')
  @HttpCode(HttpStatus.ACCEPTED)
  @ResponseMessage('Đã tiếp nhận yêu cầu gửi lại')
  resendEmail(@Body() dto: ResendRegistrationEmailDto) {
    return this.registrationsService.resendEmail(dto);
  }

  @Public()
  @Get(':token')
  @ResponseMessage('Lấy thông tin đăng ký thành công')
  getByToken(@Param('token') token: string) {
    return this.registrationsService.getByToken(token);
  }
}
