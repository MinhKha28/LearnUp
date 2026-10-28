import { Module } from '@nestjs/common';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { InternalOrganizationsController } from './internal-organizations.controller';
import { InternalOrganizationsRepository } from './internal-organizations.repository';
import { InternalOrganizationsService } from './internal-organizations.service';

@Module({
  imports: [StorageModule],
  controllers: [InternalOrganizationsController],
  providers: [InternalOrganizationsService, InternalOrganizationsRepository],
})
export class InternalOrganizationsModule {}
