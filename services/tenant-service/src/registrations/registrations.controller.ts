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
import { Public, ResponseMessage } from '../common/decorator/customize';
import { CreateRegistrationDto } from './dto/create-registrations.dto';
import { RegistrationsService } from './registrations.service';
import { PayRegistrationDto } from './dto/pay-registration.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

// Mọi endpoint ở đây dành cho Guest (chưa đăng nhập) nên đều @Public().
@ApiTags('UC02 / UC02.1 / UC03 - Registrations')
@Controller('registrations')
export class RegistrationsController {
  constructor(private readonly registrationsService: RegistrationsService) {}

  @Public()
  @Post()
  @ResponseMessage('Tạo đăng ký thành công')
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
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.registrationsService.verifyEmail(dto);
  }

  @Public()
  @Get(':token')
  @ResponseMessage('Lấy thông tin đăng ký thành công')
  getByToken(@Param('token') token: string) {
    return this.registrationsService.getByToken(token);
  }
}
