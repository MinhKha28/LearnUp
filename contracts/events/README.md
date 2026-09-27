# Event Contracts & Schemas

This directory contains the canonical JSON Schemas and sample payloads for domain events published to Apache Kafka across the LearnUP platform.

---

## 1. Schema Specifications
* [`event-envelope.schema.json`](file:///d:/Study/learnup/contracts/events/event-envelope.schema.json) — Top-level event envelope schema that all LearnUP domain events conform to.
* [`course-completed.example.json`](file:///d:/Study/learnup/contracts/events/course-completed.example.json) — Example payload for the `CourseCompleted` domain event.

---

## 2. Topic Catalog
* `learnup.learning.course-completed` — Fired by Learning Service when a learner finishes all mandatory lessons/quizzes.
* `learnup.learning.assignment-created` — Fired by Learning Service when an Organizer assigns a required course to learners.
* `learnup.assessment.peer-review-assigned` — Fired by Assessment Service when peer reviews are distributed.
* `learnup.assessment.passed` — Fired by Assessment Service when an assessment requirement is passed.
* `learnup.certificate.issued` — Fired by Achievement & Reporting Service when a certificate record is generated.
