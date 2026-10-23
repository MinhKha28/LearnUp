import { ConfigService } from '@nestjs/config';
import { RelayProducer } from './relay.producer';
import { RelayRepository } from './relay.repository';
import { RelayService } from './relay.service';
import { RELAY_CONFIG, readRelayConfig } from './relay.config';
import { Module } from '@nestjs/common';
import { OutboxController } from './outbox.controller';
import { OutboxService } from './outbox.service';

@Module({
  controllers: [OutboxController],
  providers: [
    OutboxService,
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
  exports: [OutboxService],
})
export class OutboxModule {}
