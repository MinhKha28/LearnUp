# Business Requirements Architectural Support

This document analyzes the primary graduation thesis business scenarios and explains how the LearnUP microservice architecture cleanly supports each requirement across service boundaries without leaky abstractions.

---

## 1. Required Course Assignment for Selected Learners

### Business Requirement
An `ORGANIZER` selects a set of learners (e.g. 50 learners) or a tag cohort, assigns a mandatory Course A with a due date, and tracks completion and overdue learners.

### Architectural Flow

```text
 1. UI (React) ─────────── GET /api/organizations/{orgId}/learners?tagId=... ──────────► Organization Service
                                                                                                  │
                                 ◄── Returns matching 50 Learner IDs + profiles ──────────────────┘
                                 │
 2. Organizer selects 50 learners and clicks "Assign Course A"
                                 │
 3. UI (React) ─────────── POST /api/courses/{courseId}/assign ─────────────────────────► Learning Service
                           Body: { learnerIds: [...50 IDs], dueDate: "2026-10-01" }              │
                                                                                                  │
                                                                                 1. Creates 50 assignment records
                                                                                 2. Publishes Kafka event
                                                                                                  │
 4. Kafka Event ────────── learnup.learning.assignment-created ───────────────────────────────────┤
                                                                                                  │
                                                     ┌────────────────────────────────────────────┴────────┐
                                                     ▼                                                     ▼
                                            Notification Service                                  Analytics / Tracking
                                          (Alerts 50 learners)                              (Monitors overdue deadlines)
```

### Boundary Clarity:
* **Organization Service**: Owns the learner directory and tag associations.
* **Course Service**: Owns course content and syllabus metadata.
* **Learning Service**: Owns the assignment records, completion timestamps, and overdue calculation.
* **Notification Service**: Dispatches alerts based on the asynchronous event.

---

## 2. Learner Tagging & Cohort Filtering

### Business Requirement
An Organizer creates custom organization tags (e.g., `"Sinh viên IT kỳ 2"`, `"Sinh viên IT kỳ 4"`, `"Sinh viên Kinh tế kỳ 6"`), assigns multiple tags to learners, and filters learners by tag for bulk operations.

### Architectural Flow
* **Tag Ownership**: Managed 100% within **Organization Service** (`organization_db`).
* **API Endpoints**:
  * `POST /api/organizations/{orgId}/tags` — Create tag.
  * `POST /api/organizations/{orgId}/learners/{learnerId}/tags` — Assign tag to learner.
  * `GET /api/organizations/{orgId}/learners?tagId={tagId}&search={query}` — Query matching learners.
* **Bulk Operation**: The frontend or caller passes the list of resolved learner IDs to business services (e.g., Learning Service for assignments).

---

## 3. Peer Review & Assessment Lifecycle

### Business Requirement
For open-ended essay assignments:
1. Learner submits an essay.
2. System assigns 5 peer reviews to other eligible learners.
3. Learner's own submission requirement is satisfied only when they complete their 5 peer review evaluations.
4. If a submission remains unreviewed past a timeout window, the system automatically creates an Instructor review task.

### Architectural Flow

```text
  Learner A Submits Essay
            │
            ▼
    Assessment Service (assessment_db)
            │
            ├─► 1. Stores submission record in assessment_db
            ├─► 2. Generates 5 PeerReviewAssignment entries for peers
            │
    Learner A Completes 5 Assigned Reviews
            │
            ▼
    Assessment Service checks criteria:
            - If Completed Reviews >= 5 -> Mark Learner A's requirement as SATISFIED.
            │
    Scheduled Evaluation / Timeout Watcher in Assessment Service:
            - If (now > submissionTime + reviewTimeout) AND (reviewCount < requiredReviews)
              -> Creates InstructorGradeTask record for INSTRUCTOR intervention.
```

### Boundary Clarity:
* **Assessment Service**: Owns all questions, submissions, rubrics, peer review allocations, peer grades, and instructor review tasks.
* **MCQ Questions**: Automatically scored instantly by Assessment Service using its stored answer keys without external calls.
* **Completion Event**: Once an assessment is passed, Assessment Service publishes `learnup.assessment.passed` to Kafka.
* **Learning Service**: Subscribes to assessment events to update lesson completion and overall progress.
