import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { InternalAuthGuard } from './common/guards/internal-auth.guard';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { CertificatesModule } from './modules/certificates/certificates.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CertificatesModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: InternalAuthGuard,
    },
  ],
})
export class AppModule {}
