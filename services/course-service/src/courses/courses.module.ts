import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { LearningClient } from 'src/common/clients/learning/learning.client';
import { TenantClient } from 'src/common/clients/tenant/tenant.client';

import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 0,
    }),
  ],
  controllers: [CoursesController],
  providers: [CoursesService, TenantClient, LearningClient],
  exports: [CoursesService],
})
export class CoursesModule {}
