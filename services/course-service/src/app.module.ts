import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { InternalAuthGuard } from './common/guards/internal-auth.guard';
import { APP_GUARD } from '@nestjs/core';
import { CoursesModule } from './courses/courses.module';
import { InternalCoursesModule } from './internal-courses/internal-courses.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CoursesModule,
    InternalCoursesModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: InternalAuthGuard,
    },
  ],
})
export class AppModule {}
