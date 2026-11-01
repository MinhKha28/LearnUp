import { Injectable } from '@nestjs/common';
import type { RelayRow } from './relay.repository';

/**
 * Why a send failed, as the relay needs to know it. `code` is a fixed identifier kept in `last_error` (never a message or
 * a payload). `individual` says the failure belongs to the rows, not to the destination: then one bad row must not hold
 * back the others of its batch and the relay sends them one by one. A failure that is not individual (the destination is
 * unreachable or slow) is the same for every row, so the relay keeps them all for later and does not try each.
 */
export class GateFailure extends Error {
  constructor(
    readonly code: string,
    readonly individual = false,
  ) {
    super(code);
  }
}

/**
 * Where the relay hands the events it claimed. The contract the relay relies on:
 *  - `ready()` is false when the destination cannot take events, so the relay does not even open a transaction;
 *  - `send(rows)` resolves only when every row was accepted, and rejects, with a `GateFailure` when it can tell why, when
 *    any was not. The relay then retries later, so the consumer must tolerate a repeated `eventId`.
 */
export abstract class OutboxGate {
  abstract ready(): Promise<boolean>;
  abstract send(rows: RelayRow[]): Promise<void>;
  abstract close(): Promise<void>;
}

/** A gate that accepts everything and sends nowhere: for tests of the relay and for a run without Kafka. */
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
