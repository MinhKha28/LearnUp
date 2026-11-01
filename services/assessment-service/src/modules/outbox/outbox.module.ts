import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OutboxController } from './outbox.controller';
import { OutboxService } from './outbox.service';
import { RELAY_CONFIG, readRelayConfig } from './relay.config';
import { EmptyOutboxGate, OutboxGate } from './relay.gate';
import { RelayRepository } from './relay.repository';
import { RelayService } from './relay.service';

@Module({
  controllers: [OutboxController],
  providers: [
    OutboxService,
    RelayRepository,
    RelayService,
    // Step 23 replaces this with the Kafka gate.
    { provide: OutboxGate, useClass: EmptyOutboxGate },
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
