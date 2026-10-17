import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { LearningClient } from '@infra/clients/learning/learning.client';
import { TenantClient } from '@infra/clients/tenant/tenant.client';

import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { StorageModule } from '@infra/storage/storage.module';
import { CoursesRepository } from './courses.repository';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 0,
    }),
    StorageModule,
  ],
  controllers: [CoursesController],
  providers: [CoursesService, CoursesRepository, TenantClient, LearningClient],
  exports: [CoursesService],
})
export class CoursesModule {}
