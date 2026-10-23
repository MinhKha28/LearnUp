# learning-service

NestJS + Prisma 7 service for LearnUP.

Database: `learning_db`
Port: `8085`

The Prisma schema follows `LearnUP_Database_Guide.docx` service ownership and table boundaries.


## L6 outbox relay

Enable with OUTBOX_RELAY_ENABLED=true; default false keeps unrelated tests isolated.
See .env.example for Kafka brokers, topic, replication factor, poll/batch size,
delivery/probe/transaction timeouts, exponential backoff and alert threshold.
The Docker stages use node:22-alpine3.24 (verified built image: Alpine 3.24.3, Node 22.23.4).
The Confluent client is pinned to 1.11.0 and uses native binaries for each platform;
the Docker build excludes host node_modules and generates Prisma inside Linux.

The relay publishes the four existing Enrollment events without modifying their
writers. It has at-least-once delivery; consumer eventId deduplication is required.
A failed preflight broker probe leaves attempts unchanged. Common send failures
increase attempts for every claimed head; record-specific failures are isolated
with concurrent sends. Permanently invalid heads block their aggregate until an
operator repairs the underlying issue. Logs and last_error contain safe codes only.

| Class | Confluent/librdkafka code | Action |
| --- | --- | --- |
| Record | 2 ERR_INVALID_MSG, 4 ERR_INVALID_MSG_SIZE, 10 ERR_MSG_SIZE_TOO_LARGE | Drain batch reports, then concurrent individual retry |
| Serialization | -162 ERR__KEY_SERIALIZATION, -161 ERR__VALUE_SERIALIZATION; local OUTBOX_SERIALIZATION | Concurrent individual retry |
| Connection/timeouts | -195 ERR__TRANSPORT, -193 ERR__RESOLVE, -192 ERR__MSG_TIMED_OUT, -187 ERR__ALL_BROKERS_DOWN, -185 ERR__TIMED_OUT, -166 ERR__TIMED_OUT_QUEUE, 7 ERR_REQUEST_TIMED_OUT | Back off entire batch |
| Broker/security/unknown | All other codes, including leader/ISR/auth failures | Back off entire batch |

Run unit tests with NODE_PATH pointing at this service and npm run test:unit.
Run npm run test:integration for regression. The dedicated relay test additionally
requires OUTBOX_INTEGRATION=true, a migrated test PostgreSQL database and Kafka.
It creates a unique topic/group, owns fixtures by a random organization id, and
cleans its topic and rows. OUTBOX_KAFKA_CHAOS=true additionally requires
OUTBOX_TEST_KAFKA_CONTAINER explicitly naming a disposable Compose Kafka container;
that test stops/restarts it and checks HTTP database reads while Kafka is down.
Never point chaos tests at a shared broker. Each test run measures publication
p50/p95 and prints one synthetic envelope consumed from Kafka.

## Course completion

The API worker polls durable completion_evaluation_requests. Video's first completed
transition, assignment CONVERT/RESTORE and Optional restore enqueue in their existing
transaction. CONVERT_COMPLETED does not enqueue. Reading, exemption removal and incoming
assessment/course consumers remain pending. Assessment completion HTTP uses only service
authentication and organization scope, never a fabricated Learner principal.

COMPLETION_WORKER_ENABLED defaults true (tests explicitly disable it). Defaults:
COMPLETION_POLL_MS=1000, COMPLETION_BATCH_SIZE=5, COMPLETION_LEASE_MS=30000,
COMPLETION_TRANSACTION_MS=5000, COMPLETION_BACKOFF_MS=1000,
COMPLETION_BACKOFF_MAX_MS=300000, ASSESSMENT_COMPLETION_TIMEOUT_MS=3000.
The 30-second lease leaves room beyond the 3-second HTTP timeout, 5-second transaction
budget and 1-second scheduling margin. Startup requires lease > HTTP timeout + transaction
budget + 1000 ms even if the worker is disabled. These are operational defaults, not BRs.

ASSESSMENT_COMPLETION_CLIENT_MODE defaults http. Its endpoint is not yet implemented
in assessment; until supplied, errors retain requests with bounded exponential backoff.
fake mode is forbidden in production. FakeAssessmentCompletionClient.fixtures is keyed
by organizationId/learnerId/courseId; missing fixtures return eligible=false. Explicit
fixtures support passing/failing scores, unfinalized assignments, pending/missed peer
duty, empty sets, delayed responses/timeouts and malformed responses. Test code installs
fixtures through dependency injection; no public fixture-control endpoint exists.

Claims increment generation and lease next_attempt_at using SKIP LOCKED. New triggers
increment generation, reset eligibility time and preserve attempts. Delete/retry requires
the claimed generation. A stale assessment result is discarded before any business write.
Expired claims are reclaimed, including after process death. Completion, immutable snapshot,
outbox and conditional request deletion share one transaction. Queue logs report pending,
oldest_seconds, leaseExpired and generationDiscarded; counters are process-local totals.
Logs contain fixed diagnostic codes and aggregate metrics, not scores or personal data.

The queue uses unconstrained text for source/error codes with CHECK allowlists instead of
arbitrary varchar limits; attempts and generation use nonnegative bigint for long-lived
retry/version counts. No retry maximum deletes work. The due index supports ordered bounded
claims; material indexes require EXPLAIN evidence before addition. Legacy Completed fixtures
in seed-enrollments.ts intentionally retain NULL completion_snapshot; they are not rewritten.
