import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';

import { RELAY_CONFIG, readRelayConfig } from './relay.config';

import { RelayProducer } from './relay.producer';
import { RelayRepository } from './relay.repository';
import { RelayService } from './relay.service';
import { AuditClient } from '../../infrastructure/clients/audit/audit.client';
import { CourseAuditRelayRepository } from './audit-relay.repository';
import { CourseAuditRelayService } from './audit-relay.service';

@Module({
  imports: [PrismaModule, HttpModule.register({ timeout: 5000, maxRedirects: 0 })],
  providers: [
    RelayProducer,
    RelayRepository,
    RelayService,
    AuditClient,
    CourseAuditRelayRepository,
    CourseAuditRelayService,
    {
      provide: RELAY_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        readRelayConfig((key) => config.get<string>(key)),
    },
  ],
})
export class OutboxModule {}
