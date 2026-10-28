import { Module } from '@nestjs/common';
import { InternalOrganizationsController } from './internal-organizations.controller';
import { InternalOrganizationsRepository } from './internal-organizations.repository';
import { InternalOrganizationsService } from './internal-organizations.service';

@Module({
  controllers: [InternalOrganizationsController],
  providers: [InternalOrganizationsService, InternalOrganizationsRepository],
})
export class InternalOrganizationsModule {}
