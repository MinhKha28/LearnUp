import { PartialType } from '@nestjs/swagger';
import { CreateRegistrationDto } from './create-registrations.dto';

export class UpdateRegistrationDto extends PartialType(CreateRegistrationDto) {}
