# Assessment outbox relay verification (step 23)

Date: 2026-11-01 (Asia/Ho_Chi_Minh).
Base: origin/develop 44fabb1, branch feat/assessment/completion-signal (on top of steps 21 and 22 and of the UC33.2 branch).

## Actual checks

- Unit: 297 before steps 21 to 23, 332 after (35 added: completion signal, relay settings, Kafka message and error classes).
- Integration on PostgreSQL without Kafka (what CI runs): 193/193; the Kafka suite is skipped unless `KAFKA_TEST_BROKERS` is set. With the Compose Kafka (`KAFKA_TEST_BROKERS=localhost:9092`): 198/198 (5 Kafka tests).
- Native `npm run build`: successful. Docker image build: successful. Built image: Node 22.23.4, Alpine 3.24.3, musl; both stages pin `node:22-alpine3.24` as learning-service does.
- Compose configuration validation: successful.
- `prisma migrate deploy` of every migration on an empty database, then `prisma migrate diff` against `schema.prisma`: no difference.
- Windows Confluent 1.11.0 native install: successful.
- Mutation checks, each caught by a test: no `SKIP LOCKED`, no per-Learner ordering (the old per-aggregate claim fails it too), no event type filter, a failure of the whole batch for one bad row, a failure of the destination handled row by row, the key of the message not the Learner, a wrong producer, a constant `revision`.
- Image and API smoke on the Compose stack (assessment-service container, Compose Postgres and Kafka): a real waiver (UC33.2) through the container wrote one outbox row, the relay of the container published it, and the message was read from the topic with `kafka-console-consumer` (below).
- Two relays at the same moment (integration): 20 Learners x 3 events, two Kafka gates, every event received once and the events of a Learner in the order they were written.
- Kafka stopped before the relay turn: the service serves a database read with HTTP 200, the waiver answers 200, the row stays unsent with `attempts` 0 (no row was claimed), one `OUTBOX_GATE_UNAVAILABLE` warning. Kafka started again: the same running service delivered the queued event, 28 seconds after the start of the Kafka container (this includes the time the broker needs to become healthy), with no restart.
- Graceful stop: `docker stop` took 819 ms and the container exited with code 0 (the shutdown hooks ran: the relay finishes the batch it holds before Kafka and Prisma are closed).

## Message consumed from the container

Synthetic dev fixture (a dev Learner and the dev UC33 Assignment):

```json
{
  "key": "06e50f10-1742-42f0-b0c5-5196774dca5a",
  "body": {
    "eventId": "01a19678-0ef9-73c2-924c-1864ef0d4372",
    "eventType": "LearnerAssessmentStatusChanged",
    "version": 1,
    "occurredAt": "2026-11-01T09:36:52.944Z",
    "organizationId": "01900000-0000-7000-8000-00000000a001",
    "producer": "assessment-service",
    "data": {
      "kind": "ASSIGNMENT",
      "reason": "PEER_REVIEW_WAIVED",
      "status": "PeerReviewWaived",
      "courseId": "01900000-0000-7000-8000-0000000e0007",
      "revision": "cd2633817120a774267651922731651a3f4a5a8bbb822565bf0d7874a828f3bc",
      "waivedBy": "01900000-0000-7000-8000-00000000a101",
      "learnerId": "06e50f10-1742-42f0-b0c5-5196774dca5a",
      "assessmentId": "01900000-0000-7000-8000-0000000a3311",
      "organizationId": "01900000-0000-7000-8000-00000000a001",
      "firstActivityAt": "2026-10-12T09:36:52.691Z"
    }
  }
}
```

The topic is `learnup.assessment.learner-assessment-events` (3 partitions, replication factor 1 in Compose, retention 30 days). The key is the Learner, so the events of one Learner stay in order on one partition.

## Error classification

| Codes | Classification / action |
| --- | --- |
| 2 ERR_INVALID_MSG, 4 ERR_INVALID_MSG_SIZE, 10 ERR_MSG_SIZE_TOO_LARGE | Record-specific: the pending delivery reports are drained, then each row is sent alone |
| -162 ERR__KEY_SERIALIZATION, -161 ERR__VALUE_SERIALIZATION, local OUTBOX_SERIALIZATION (no organization, no `learnerId`, payload not an object) | Record-specific: each row is sent alone, the bad one fails with its code |
| -195 transport, -193 DNS, -192 delivery timeout, -187 brokers down, -185 timeout, 7 request timeout, any other code | Common: every claimed row backs off, no row is tried alone |
| An error without a number | Common, code `OUTBOX_UNKNOWN`; its text is never stored or logged |

`last_error` holds `KAFKA_<code>` or a fixed `OUTBOX_*` identifier. The retry delay is `min(1000 * 2^(attempts - 1), 300000)` ms; from attempt 10 every failure logs `OUTBOX_RETRY_ALERT`. Nothing is skipped or published by itself.

## Environment and limits

- Delivery is at-least-once: the PostgreSQL commit and the Kafka acknowledgement are not atomic, and a batch that falls back to one send per row can send a row twice. Consumers must deduplicate `eventId`.
- Events written before step 21 have none of `reason`, `revision` and `firstActivityAt` in `data` (and no `organizationId` there; the envelope has it). The dev database held seven of them; the relay published them when it first ran, so a consumer must read these fields as optional.
- The first connection of a Confluent client to the Compose Kafka from this Windows host is slow and uneven: 1.4 to 12 seconds, sometimes with a few `-195 Broker transport failure` answers before one succeeds, while a probe of a connected client takes 2 ms. The gate therefore replaces its clients after a probe that runs out of time or after three failed probes in a row, and the first creation of the topic is retried by the next relay turn. The Kafka integration tests wait for it (up to 90 seconds) and passed 4 runs in a row on this host after the last change (3 runs of the file and one full integration run); before it, several runs had one to four failing tests for this reason.
- Two integration tests of the UC33.2 waiver failed once, and one UC29 run failed once, each in the first run after the PostgreSQL container was started; the runs after them passed (three in a row). The cause was not found.
- The Kafka integration tests are not part of CI: CI has no Kafka. They run with `KAFKA_TEST_BROKERS` set.
- Not tested: a deployed consumer (learning-service L18 does not exist yet), several brokers or a replication factor above 1, production failover, publication latency (not measured), the cleanup schedule over a real hour (the query is tested on PostgreSQL; the hourly timer is not waited for).
- The claim query uses the existing `(published_at)` index. A partial index on unsent rows is not added; with a table this small the cost is a scan of the unsent rows.
- `npm audit` findings of the dependency trees are unchanged by this work; `@confluentinc/kafka-javascript` 1.11.0 and its dependencies were added.

## Changed files

- `contracts/events/README.md`
- `docker-compose.yml`
- `docs/architecture/assessment-outbox-relay-verification.md`
- `docs/architecture/event-driven.md`
- `docs/database/AssessmentService_Database_Design.md`
- `services/assessment-service/.env.example`
- `services/assessment-service/Dockerfile`
- `services/assessment-service/Dockerfile.dockerignore`
- `services/assessment-service/package.json`
- `services/assessment-service/package-lock.json`
- `services/assessment-service/src/infrastructure/prisma/prisma.service.ts`
- `services/assessment-service/src/main.ts`
- `services/assessment-service/src/modules/outbox/outbox.module.ts`
- `services/assessment-service/src/modules/outbox/relay.config.ts`
- `services/assessment-service/src/modules/outbox/relay.gate.ts`
- `services/assessment-service/src/modules/outbox/relay.kafka-gate.ts`
- `services/assessment-service/src/modules/outbox/relay.repository.ts`
- `services/assessment-service/src/modules/outbox/relay.service.ts`
- `services/assessment-service/test/integration/index.ts`
- `services/assessment-service/test/integration/outbox-helpers.ts`
- `services/assessment-service/test/integration/outbox-kafka.integration-test.ts`
- `services/assessment-service/test/integration/outbox-relay.integration-test.ts`
- `services/assessment-service/test/unit/index.ts`
- `services/assessment-service/test/unit/relay-kafka.unit-test.ts`
