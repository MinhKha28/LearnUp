import { Module } from '@nestjs/common';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { AdminOrganizationsController } from './admin-organizations.controller';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsRepository } from './organizations.repository';
import { OrganizationsService } from './organizations.service';

@Module({
  imports: [StorageModule],
  controllers: [OrganizationsController, AdminOrganizationsController], // UC11, UC44
  providers: [OrganizationsService, OrganizationsRepository],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
