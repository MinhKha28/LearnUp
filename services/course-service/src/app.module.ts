import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { InternalAuthGuard } from './common/guards/internal-auth.guard';
import { APP_GUARD } from '@nestjs/core';
import { CoursesModule } from './modules/courses/courses.module';
import { InternalCoursesModule } from './modules/internal-courses/internal-courses.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { OutboxModule } from './modules/outbox/outbox.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CatalogModule,
    CoursesModule,
    InternalCoursesModule,
    OutboxModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: InternalAuthGuard,
    },
  ],
})
export class AppModule {}
