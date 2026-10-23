# L6 learning outbox relay verification

Date: 2026-10-23 (Asia/Ho_Chi_Minh).
Base: origin/develop a793daa16c5ff3f388b21a8bdfbd4fac84bd4c55.
Branch: feat/learning/uc24.2-uc25.4-outbox-relay.

## Actual checks

- Baseline unit: 228/228. Final unit: 242/242 (14 added).
- Full integration: 158/158, no skips (154 existing + 4 L6).
- Native npm run build: successful. Docker image build: successful.
- Compose config validation: successful using temporary test-only environment.
- Windows Confluent 1.11.0 native install: successful.
- Image/API Compose smoke: published outbox row and consumed matching envelope/key from inside the Linux container.
- Built image: Node 22.23.4, Alpine 3.24.3. Both stages pin node:22-alpine3.24.
- Two concurrent relays: 50 Enrollment aggregates x 3 events, 150 received, 150 unique eventIds, every aggregate sequence [1,2,3].
- Backoff head blocks successors; cleanup preserves unpublished and recent published rows.
- Kafka down before preflight: 0 transactions, 0ms transaction hold, attempts unchanged; API database-backed read returns HTTP 200.
- Kafka disappearing after preflight: one transaction, about 10 seconds held (<30s), failed head attempts increments, remains unpublished, successor blocked. Recovery sends [1,2].
- Unit coverage includes stable envelope/retry identity, config budgets, parallel record isolation, common-failure no-fallback, bounded backoff, safe error logging, synthetic secret redaction in publication transaction, and shutdown waiting for delivery.

Final measured outputs (milliseconds):

```text
L6 latency_ms {"p50":706.6475,"p95":1256.5235}
L6 Kafka down {"heldMs":0,"transactionCalls":0,"apiMs":37.386099999999715,"tickMs":1015.5597999999991}
L6 outage after preflight {"heldMs":10017.400100000003,"transactionCalls":1}
```

Latency measures insertion-to-published_at for this local test workload; it is not end-to-end email latency or a production SLA.

## Error classification

| Codes | Classification / action |
| --- | --- |
| 2 ERR_INVALID_MSG, 4 ERR_INVALID_MSG_SIZE, 10 ERR_MSG_SIZE_TOO_LARGE | Record-specific: drain pending batch reports, then concurrent per-row sends |
| -162 ERR__KEY_SERIALIZATION, -161 ERR__VALUE_SERIALIZATION, local OUTBOX_SERIALIZATION | Record-specific: concurrent per-row sends |
| -195 transport, -193 DNS, -192 delivery timeout, -187 brokers down, -185 timeout, -166 queued timeout, 7 request timeout | Common: back off all claimed heads, no per-row fallback |
| Other codes, broker/leader/ISR/auth failures, unrecognized exceptions | Common: back off all claimed heads |

Stored/logged errors are numeric KAFKA_<code> or fixed OUTBOX_* identifiers. No arbitrary error message or payload is logged. Retry delay is min(1000 * 2^(attempts-1), 300000)ms; alert starts at attempt 10. No automatic skipping/publication.

## Message consumed from the API container

Synthetic test fixture only:

```json
{
  "key": "8eb38a24-7b2d-4598-a477-cb31f0ef2a84",
  "body": {
    "eventId": "1d3e3e55-7ace-4d48-ac9d-4c02355f8d9e",
    "eventType": "EnrollmentAssigned",
    "version": 1,
    "occurredAt": "2026-10-23T13:24:10.829Z",
    "organizationId": "cda775cb-4d21-410d-979f-c94c8ec8b516",
    "producer": "learning-service",
    "data": {
      "kind": "created",
      "dueAt": "2026-12-01T00:00:00.000Z",
      "courseId": "b2ab8537-2234-4407-93ff-aff997ff4da9",
      "learnerId": "188aa316-ed75-4fcb-a879-4dd3ad000a8a",
      "assignedAt": "2026-10-23T13:24:10.829Z",
      "assignedBy": "3977db9d-a971-417d-a8e3-96d749c7f62a",
      "enrollmentId": "8eb38a24-7b2d-4598-a477-cb31f0ef2a84",
      "organizationId": "cda775cb-4d21-410d-979f-c94c8ec8b516"
    }
  }
}
```

## Environment and limits

No change to the three event writers or notification-service. No change to the agreed delivery semantics. Delivery remains at-least-once; consumer eventId deduplication is required. PostgreSQL commit and Kafka ACK are not atomic.

Test infrastructure used the existing Compose services in a separate learnup-l6-test project with temporary container-name overrides and random credentials kept outside Git. Course regression required both the older fixture bundled in the existing course image and the current additive canonical seed. Initial regression failures from wrong credentials/port/missing fixtures were resolved; assertions were not weakened. No course-service repository files were modified.

The hourly cleanup query is tested on real PostgreSQL; tests do not wait an actual hour. Production failover, multi-broker replication, a deployed downstream consumer, and production email latency have not been tested. Existing UUID ordering is retained, without changing event writers.

npm audit reports six existing findings (2 moderate, 4 high) in Swagger/Prisma dependency trees. Their locked versions are unchanged; no vulnerable package was upgraded as part of this task. Follow-up dependency remediation remains outside L6.

The cleanup schedule is independent of broker readiness. Prisma disconnect moved to onApplicationShutdown so relay beforeApplicationShutdown can drain delivery and cleanup first. Docker-specific ignore rules exclude host native modules, generated sources and environment files.

## Changed files

- `contracts/events/README.md`
- `contracts/events/learning-enrollment-events.md`
- `docker-compose.yml`
- `docs/architecture/event-driven.md`
- `docs/architecture/learning-outbox-relay-verification.md`
- `services/learning-service/.env.example`
- `services/learning-service/Dockerfile`
- `services/learning-service/Dockerfile.dockerignore`
- `services/learning-service/README.md`
- `services/learning-service/package-lock.json`
- `services/learning-service/package.json`
- `services/learning-service/prisma/migrations/20261023120000_outbox_relay/migration.sql`
- `services/learning-service/prisma/schema.prisma`
- `services/learning-service/src/infrastructure/prisma/prisma.service.ts`
- `services/learning-service/src/main.ts`
- `services/learning-service/src/modules/outbox/outbox.module.ts`
- `services/learning-service/src/modules/outbox/relay.config.ts`
- `services/learning-service/src/modules/outbox/relay.producer.ts`
- `services/learning-service/src/modules/outbox/relay.repository.ts`
- `services/learning-service/src/modules/outbox/relay.service.ts`
- `services/learning-service/test/integration/index.ts`
- `services/learning-service/test/integration/outbox-container-smoke.cjs`
- `services/learning-service/test/integration/outbox-relay.integration-test.ts`
- `services/learning-service/test/integration/tenant-lookup-config.ts`
- `services/learning-service/test/unit/index.ts`
- `services/learning-service/test/unit/outbox-relay.unit-test.ts`
