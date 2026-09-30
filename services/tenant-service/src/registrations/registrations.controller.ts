import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public, ResponseMessage } from '../common/decorator/customize';
import { CreateRegistrationDto } from './dto/create-registrations.dto';
import { RegistrationsService } from './registrations.service';

// Mọi endpoint ở đây dành cho Guest (chưa đăng nhập) nên đều @Public().
@ApiTags('UC02 / UC02.1 / UC03 - Registrations')
@Controller('registrations')
export class RegistrationsController {
  constructor(private readonly registrationsService: RegistrationsService) {}

  // UC02
  @Public()
  @Post()
  @ResponseMessage('Tạo đăng ký thành công')
  create(@Body() dto: CreateRegistrationDto) {
    return this.registrationsService.create(dto);
  }
}
