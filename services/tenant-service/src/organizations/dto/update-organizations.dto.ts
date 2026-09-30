import { PartialType } from '@nestjs/swagger';
import { CreateOrganizationDto } from './create-organizations.dto';

export class UpdateOrganizationDto extends PartialType(CreateOrganizationDto) {}
