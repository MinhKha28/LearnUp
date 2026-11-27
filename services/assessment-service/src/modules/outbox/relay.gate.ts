import { classifyKafkaRelayError } from '@learnup/ts-common';
import { Injectable } from '@nestjs/common';
import type { RelayRow } from './relay.repository';

/**
 * `code` is why the probe failed. `rebuildCode` is set only when the clients were then rebuilt
 * and that rebuild failed too; it never replaces `code`.
 */
export type GateReadiness =
  | { status: 'ready' }
  | { status: 'missing-topics'; topics: string[] }
  | { status: 'broker-failure'; code: string; rebuildCode?: string };

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

/** What the failure is called in `last_error`: a fixed identifier, never the text of the error. A named failure passes through as it is. */
export function toGateFailure(error: unknown): GateFailure {
  if (error instanceof GateFailure) return error;
  const { code, individual } = classifyKafkaRelayError(error);
  return new GateFailure(code, individual);
}

/**
 * Where the relay hands the events it claimed. The contract the relay relies on:
 *  - `ready()` returns an unavailable result when the destination cannot take events, so the relay does not even open a transaction;
 *  - `send(rows)` resolves only when every row was accepted, and rejects, with a `GateFailure` when it can tell why, when
 *    any was not. The relay then retries later, so the consumer must tolerate a repeated `eventId`.
 */
export abstract class OutboxGate {
  abstract ready(): Promise<GateReadiness>;
  abstract send(rows: RelayRow[]): Promise<void>;
  abstract close(): Promise<void>;
}

/** A gate that accepts everything and sends nowhere: for tests of the relay and for a run without Kafka. */
@Injectable()
export class EmptyOutboxGate extends OutboxGate {
  ready(): Promise<GateReadiness> {
    return Promise.resolve({ status: 'ready' });
  }
  send(): Promise<void> {
    return Promise.resolve();
  }
  close(): Promise<void> {
    return Promise.resolve();
  }
}
