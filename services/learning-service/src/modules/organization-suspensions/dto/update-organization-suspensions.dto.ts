import { PartialType } from '@nestjs/swagger';
import { CreateOrganizationSuspensionDto } from './create-organization-suspensions.dto';

export class UpdateOrganizationSuspensionDto extends PartialType(CreateOrganizationSuspensionDto) {}
