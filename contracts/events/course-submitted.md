# CourseSubmitted (UC20)

Producer: `course-service`. Topic: `learnup.course.course-component-events`.
Kafka key: `courseId` (Outbox aggregate ID). Envelope: [v1](event-envelope.schema.json).
Event type: `CourseSubmitted`; event ID: Outbox row ID. Delivery: at least once.

The event is written in the same database transaction as a successful
Draft/Rejected -> Submitted status transition. An invalid state, incomplete
Course, or Quiz without questions must not produce the event.

Payload (`data`):
- `organizationId`, `courseId`, `instructorId`: UUID strings.
- `courseName`: non-empty Course name.
- `versionNumber`: positive integer.
- `occurredAt`, `submittedAt`: UTC ISO-8601 timestamps.
- `data.organizationId` and `data.courseId` must match the envelope;
  `data.occurredAt` must match the envelope's `occurredAt`.

Notification Service is the intended consumer for Organizer approval notices
(English email and in-app notification). A consumer must isolate the topic's other
Course events, validate the envelope and payload, deduplicate by
`eventId + recipientUserId + channel`, and retry temporary failures without
replaying successful channels. Publishing to the Outbox alone does not guarantee
notification delivery; deployment must enable the consumer.

See [example](course-submitted.example.json).
