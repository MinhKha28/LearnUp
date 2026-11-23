# Asynchronous event delivery

Services use REST for operations that require an immediate response. Kafka distributes business facts to subscribers after the originating change, such as certificate issuance after `EnrollmentCompleted`.

## Transactional outbox

The business transaction commits the domain change and its outbox row together. A relay selects pending rows using `FOR UPDATE SKIP LOCKED`, publishes the event, and records publication after the broker acknowledges it. The broker write and the database update cannot commit atomically, so a retry may publish the same event ID. Consumers use event IDs and domain constraints to make repeated deliveries safe.

See the [Course relay](../../services/course-service/src/modules/outbox/README.md), [Learning relay](../../services/learning-service/src/modules/outbox) and [Assessment relay](../../services/assessment-service/src/modules/outbox).

## Streams and contracts

A stream can carry multiple event types. Partition keys preserve ordering for a course, enrollment or learner where the contract specifies it. See the [deployed topic catalog](../../contracts/events/README.md) and the [event envelope schema](../../contracts/events/event-envelope.schema.json).
