import { Injectable } from '@nestjs/common';
import type { RelayRow } from './relay.repository';

/**
 * Where the relay hands the events it claimed. Step 23 puts Kafka behind it; the contract the relay relies on:
 *  - `ready()` is false when the destination cannot take events, so the relay does not even open a transaction;
 *  - `send(rows)` resolves only when every row was accepted, and rejects when any was not (the relay then retries all of
 *    them later, so the consumer must tolerate a repeated `eventId`).
 */
export abstract class OutboxGate {
  abstract ready(): Promise<boolean>;
  abstract send(rows: RelayRow[]): Promise<void>;
  abstract close(): Promise<void>;
}

/**
 * The gate of step 22: accepts everything and sends nowhere. The relay is off by default (OUTBOX_RELAY_ENABLED), because
 * with this gate a claimed event would be marked as published without anybody having received it.
 */
@Injectable()
export class EmptyOutboxGate extends OutboxGate {
  ready(): Promise<boolean> {
    return Promise.resolve(true);
  }
  send(): Promise<void> {
    return Promise.resolve();
  }
  close(): Promise<void> {
    return Promise.resolve();
  }
}
