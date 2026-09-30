import { Controller } from '@nestjs/common';
import { RegistrationsService } from './registrations.service';

@Controller('registrations')
export class RegistrationsController {
  constructor(private readonly service: RegistrationsService) {}
}
