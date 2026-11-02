import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';

import { RELAY_CONFIG, readRelayConfig } from './relay.config';

import { RelayProducer } from './relay.producer';
import { RelayRepository } from './relay.repository';
import { RelayService } from './relay.service';

@Module({
  imports: [PrismaModule],
  providers: [
    RelayProducer,
    RelayRepository,
    RelayService,
    {
      provide: RELAY_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        readRelayConfig((key) => config.get<string>(key)),
    },
  ],
})
export class OutboxModule {}
