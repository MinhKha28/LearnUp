import { Controller } from '@nestjs/common';
import { OrganizationSuspensionsService } from './organization-suspensions.service';

@Controller('organization-suspensions')
export class OrganizationSuspensionsController {
  constructor(private readonly service: OrganizationSuspensionsService) {}
}
