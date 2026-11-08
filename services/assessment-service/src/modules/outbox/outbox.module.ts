import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OutboxController } from './outbox.controller';
import { OutboxService } from './outbox.service';
import { RELAY_CONFIG, readRelayConfig } from './relay.config';
import { OutboxGate } from './relay.gate';
import { KafkaOutboxGate } from './relay.kafka-gate';
import { RelayRepository } from './relay.repository';
import { RelayService } from './relay.service';

@Module({
  controllers: [OutboxController],
  providers: [
    OutboxService,
    RelayRepository,
    RelayService,
    { provide: OutboxGate, useClass: KafkaOutboxGate },
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
