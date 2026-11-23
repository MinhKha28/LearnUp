# Kafka event contracts

The [Compose configuration](../../docker-compose.yml) supplies the default streams.

| Topic | Producer | Events and contracts |
| --- | --- | --- |
| `learnup.course.course-component-events` | Course | `CourseDisabled`, `CourseReactivated`, `CourseComponentDisabled`, `CourseComponentReactivated`, [CourseSubmitted](course-submitted.md), `CoursePublished`, `CourseRejected`, `CourseOwnershipTransferred`. See the [relay registry](../../services/course-service/src/modules/outbox/relay.producer.ts). |
| `learnup.learning.enrollment-events` | Learning | `EnrollmentAssigned`, `EnrollmentDueDateExtended`, `EnrollmentExempted`, `LearnerWithdrew`, `EnrollmentCompleted`. See [Learning enrollment events](learning-enrollment-events.md). |
| `learnup.assessment.learner-assessment-events` | Assessment | [LearnerAssessmentStatusChanged](assessment-status-events.md). |
| `learnup.assessment.peer-review-assigned` | Assessment | [PeerReviewAssigned](assessment-peer-review-events.md). |
| `learnup.assessment.submission-finalized` | Assessment | [SubmissionFinalized](assessment-submission-finalized.md), dedicated result notices (consumer before producer). |

Notification's consumer dead-letter handling is specified by the [enrollment contract](learning-enrollment-events.md#notification-service-consumer).

Examples using the [canonical envelope](event-envelope.schema.json) include [CourseSubmitted](course-submitted.example.json) and [EnrollmentCompleted](enrollment-completed.example.json).

Topic names and partition/replica shapes are authoritative in [topics.tsv](../../infrastructure/kafka/topics.tsv). Deployment and drift procedures live in the [Kafka guide](../../infrastructure/kafka/README.md).
