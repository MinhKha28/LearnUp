# Apache Kafka Infrastructure (`infrastructure/kafka`)

## Technology Stack
* Apache Kafka (Confluent Platform / KRaft mode)
* Local Port: `9092` (Host access), `29092` (Internal Docker network)

## Responsibilities
* Asynchronous domain event bus.
* Partition-based message distribution for event consumers (Certificate Service, Notification Service, Learning Service).
* Implements the standardized event envelope (`contracts/events/event-envelope.schema.json`).

## Core Topics
* `learnup.learning.course-completed`
* `learnup.learning.assignment-created`
* `learnup.assessment.peer-review-assigned`
* `learnup.assessment.passed`
* `learnup.certificate.issued`
* `learnup.organization.member-invited`
