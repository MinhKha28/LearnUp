/** What the integration tests of the outbox relay share: ids, rows of the outbox and a relay over its own connection. */
import { randomBytes } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { LEARNER_STATUS_CHANGED_EVENT } from '../../src/modules/learner-submissions/learner-submissions.constants';
import {
  readRelayConfig,
  type RelayConfig,
} from '../../src/modules/outbox/relay.config';
import type { OutboxGate } from '../../src/modules/outbox/relay.gate';
import { RelayRepository } from '../../src/modules/outbox/relay.repository';
import { RelayService } from '../../src/modules/outbox/relay.service';
import { ORG, sleep, type TestDatabase } from './harness';

/** A UUID v7 like the ones Prisma writes: the first 48 bits are the time, so a later row sorts after an earlier one. */
export const uuid7 = (): string => {
  const hex = Date.now().toString(16).padStart(12, '0');
  const random = randomBytes(10).toString('hex');
  const variant = ((parseInt(random[3], 16) & 3) | 8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8)}-7${random.slice(0, 3)}-${variant}${random.slice(4, 7)}-${random.slice(7, 19)}`;
};

export const aggregate = (n: number) =>
  `00000000-0000-4000-8000-${(0xb00 + n).toString(16).padStart(12, '0')}`;

export const relayConfig = (over: Record<string, string> = {}): RelayConfig =>
  readRelayConfig((key) => ({ OUTBOX_BACKOFF_MS: '60000', ...over })[key]);

/** A relay of its own, with its own connection to the database, over the given gate. */
export function relayOver(
  db: TestDatabase,
  prismas: PrismaService[],
  gate: OutboxGate,
  over: Record<string, string> = {},
): RelayService {
  const prisma = new PrismaService({
    getOrThrow: () => db.url,
  } as unknown as ConfigService);
  prismas.push(prisma);
  const settings = relayConfig(over);
  return new RelayService(
    new RelayRepository(prisma, settings),
    gate,
    settings,
  );
}

/** Writes events of one aggregate and returns their ids, oldest first. The payload carries the Learner, as the real ones do. */
export async function addEvents(
  db: TestDatabase,
  aggregateId: string,
  type = LEARNER_STATUS_CHANGED_EVENT,
  count = 1,
  payload: Record<string, unknown> = { learnerId: aggregateId, n: 1 },
): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const [row] = await db.query(
      `INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, organization_id, payload, occurred_at, created_at, updated_at)
       VALUES ($4, 'LearnerAssessmentState', $1, $2, $3, $5::jsonb, now(), now(), now()) RETURNING id`,
      [
        aggregateId,
        type,
        ORG,
        uuid7(),
        JSON.stringify({ ...payload, sequence: i + 1 }),
      ],
    );
    ids.push(row.id as string);
    await sleep(2); // ids are time-ordered: two rows of the same moment would have no order
  }
  return ids;
}
