import { Module } from '@nestjs/common';
import { OrganizationSuspensionsController } from './organization-suspensions.controller';
import { OrganizationSuspensionsService } from './organization-suspensions.service';

@Module({
  controllers: [OrganizationSuspensionsController],
  providers: [OrganizationSuspensionsService],
  exports: [OrganizationSuspensionsService],
})
export class OrganizationSuspensionsModule {}
