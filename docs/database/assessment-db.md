# Assessment database reference

Database `assessment_db`. See [conventions](conventions.md) and [Prisma schema and migrations](../../services/assessment-service/prisma/migrations).

[Mapped Prisma models](../../services/assessment-service/prisma/schema.prisma).

## Invariants

- Quiz attempts and recorded assessment state are distinct so repeated attempts can be retained without overwriting the recorded result.
- Assessment and review changes that affect Learning write an outbox row in the same transaction. The relay publishes both assessment status events and peer review assignment events. Learning consumes the status stream, and Notification consumes the assignment stream.
- Review indexes support reading submissions and assigned reviews by cycle or submission. The organization and reviewer index supports a learner's review queue.
- Review obligation is derived from review records and exemptions. The same calculation serves completion snapshots and the assignment submission flow.

## Tables

### `assessments`

| Column | PostgreSQL definition |
| --- | --- |
| `id` | `UUID NOT NULL` |
| `organization_id` | `UUID NOT NULL` |
| `course_id` | `UUID NOT NULL` |
| `module_id` | `UUID` |
| `kind` | `TEXT NOT NULL` |
| `title` | `VARCHAR(200) NOT NULL` |
| `position` | `INTEGER NOT NULL` |
| `passing_score` | `DECIMAL(5,2) NOT NULL` |
| `max_consecutive_attempts` | `INTEGER NOT NULL` |
| `lockout_hours` | `INTEGER NOT NULL` |
| `is_required` | `BOOLEAN NOT NULL` |
| `time_limit_minutes` | `INTEGER` |
| `prompt` | `VARCHAR(8000)` |
| `prompt_file_key` | `TEXT` |
| `prompt_file_name` | `VARCHAR(255)` |
| `prompt_file_mime` | `VARCHAR(255)` |
| `prompt_file_size_bytes` | `BIGINT` |
| `expected_duration_minutes` | `INTEGER` |
| `peer_review_enabled` | `BOOLEAN NOT NULL DEFAULT false` |
| `peer_reviewers_per_submission` | `SMALLINT` |
| `peer_review_cycle_days` | `INTEGER` |
| `peer_review_deadline_days` | `INTEGER` |
| `peer_review_score_gap` | `DECIMAL(5,2)` |
| `disabled_at` | `TIMESTAMPTZ` |
| `copied_from_id` | `UUID` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMPTZ NOT NULL` |

```sql
ALTER TABLE assessments ADD CONSTRAINT "assessments_pkey" PRIMARY KEY ("id");
CREATE INDEX "assessments_organization_id_course_id_idx" ON "assessments"("organization_id", "course_id");
```

### `quiz_questions`

| Column | PostgreSQL definition |
| --- | --- |
| `id` | `UUID NOT NULL` |
| `organization_id` | `UUID NOT NULL` |
| `assessment_id` | `UUID NOT NULL` |
| `question_type` | `TEXT NOT NULL` |
| `content` | `VARCHAR(2000) NOT NULL` |
| `position` | `INTEGER NOT NULL` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMPTZ NOT NULL` |

```sql
ALTER TABLE quiz_questions ADD CONSTRAINT "quiz_questions_pkey" PRIMARY KEY ("id");
ALTER TABLE quiz_questions ADD CONSTRAINT "quiz_questions_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "quiz_questions_assessment_id_position_key" ON "quiz_questions"("assessment_id", "position");
```

### `quiz_question_options`

| Column | PostgreSQL definition |
| --- | --- |
| `id` | `UUID NOT NULL` |
| `organization_id` | `UUID NOT NULL` |
| `question_id` | `UUID NOT NULL` |
| `content` | `VARCHAR(500) NOT NULL` |
| `is_correct` | `BOOLEAN NOT NULL` |
| `position` | `INTEGER NOT NULL` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMPTZ NOT NULL` |

```sql
ALTER TABLE quiz_question_options ADD CONSTRAINT "quiz_question_options_pkey" PRIMARY KEY ("id");
ALTER TABLE quiz_question_options ADD CONSTRAINT "quiz_question_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "quiz_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "quiz_question_options_question_id_position_key" ON "quiz_question_options"("question_id", "position");
```

### `rubric_criteria`

| Column | PostgreSQL definition |
| --- | --- |
| `id` | `UUID NOT NULL` |
| `organization_id` | `UUID NOT NULL` |
| `assessment_id` | `UUID NOT NULL` |
| `name` | `VARCHAR(200) NOT NULL` |
| `description` | `VARCHAR(500) NOT NULL` |
| `max_points` | `SMALLINT NOT NULL` |
| `position` | `INTEGER NOT NULL` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMPTZ NOT NULL` |

```sql
ALTER TABLE rubric_criteria ADD CONSTRAINT "rubric_criteria_pkey" PRIMARY KEY ("id");
ALTER TABLE rubric_criteria ADD CONSTRAINT "rubric_criteria_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "rubric_criteria_assessment_id_position_key" ON "rubric_criteria"("assessment_id", "position");
```

### `learner_assessment_states`

| Column | PostgreSQL definition |
| --- | --- |
| `id` | `UUID NOT NULL` |
| `organization_id` | `UUID NOT NULL` |
| `assessment_id` | `UUID NOT NULL` |
| `learner_id` | `UUID NOT NULL` |
| `first_activity_at` | `TIMESTAMPTZ NOT NULL` |
| `consecutive_count` | `INTEGER NOT NULL DEFAULT 0` |
| `locked_until` | `TIMESTAMPTZ` |
| `recorded_attempt_id` | `UUID` |
| `latest_submission_id` | `UUID` |
| `exempted_at` | `TIMESTAMPTZ` |
| `exempted_by` | `UUID` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMPTZ NOT NULL` |

```sql
ALTER TABLE learner_assessment_states ADD CONSTRAINT "learner_assessment_states_pkey" PRIMARY KEY ("id");
ALTER TABLE learner_assessment_states ADD CONSTRAINT "learner_assessment_states_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "learner_assessment_states_assessment_id_learner_id_key" ON "learner_assessment_states"("assessment_id", "learner_id");
```

### `quiz_attempts`

| Column | PostgreSQL definition |
| --- | --- |
| `id` | `UUID NOT NULL` |
| `organization_id` | `UUID NOT NULL` |
| `assessment_id` | `UUID NOT NULL` |
| `learner_id` | `UUID NOT NULL` |
| `attempt_number` | `INTEGER NOT NULL` |
| `started_at` | `TIMESTAMPTZ NOT NULL` |
| `deadline_at` | `TIMESTAMPTZ NOT NULL` |
| `submitted_at` | `TIMESTAMPTZ` |
| `submission_kind` | `TEXT` |
| `score` | `DECIMAL(5,2)` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMPTZ NOT NULL` |

```sql
ALTER TABLE quiz_attempts ADD CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id");
ALTER TABLE quiz_attempts ADD CONSTRAINT "quiz_attempts_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "quiz_attempts_assessment_id_learner_id_attempt_number_key" ON "quiz_attempts"("assessment_id", "learner_id", "attempt_number");
```

### `quiz_attempt_answers`

| Column | PostgreSQL definition |
| --- | --- |
| `id` | `UUID NOT NULL` |
| `organization_id` | `UUID NOT NULL` |
| `attempt_id` | `UUID NOT NULL` |
| `question_id` | `UUID NOT NULL` |
| `option_id` | `UUID NOT NULL` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMPTZ NOT NULL` |

```sql
ALTER TABLE quiz_attempt_answers ADD CONSTRAINT "quiz_attempt_answers_pkey" PRIMARY KEY ("id");
ALTER TABLE quiz_attempt_answers ADD CONSTRAINT "quiz_attempt_answers_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "quiz_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE quiz_attempt_answers ADD CONSTRAINT "quiz_attempt_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "quiz_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "quiz_attempt_answers_attempt_id_question_id_option_id_key" ON "quiz_attempt_answers"("attempt_id", "question_id", "option_id");
```

### `submissions`

| Column | PostgreSQL definition |
| --- | --- |
| `id` | `UUID NOT NULL` |
| `organization_id` | `UUID NOT NULL` |
| `assessment_id` | `UUID NOT NULL` |
| `learner_id` | `UUID NOT NULL` |
| `submission_number` | `INTEGER NOT NULL` |
| `content` | `VARCHAR(20000)` |
| `file_key` | `TEXT` |
| `file_name` | `VARCHAR(255)` |
| `file_mime` | `VARCHAR(255)` |
| `file_size_bytes` | `BIGINT` |
| `submitted_at` | `TIMESTAMPTZ NOT NULL` |
| `cycle_id` | `UUID` |
| `superseded_at` | `TIMESTAMPTZ` |
| `grading_status` | `TEXT NOT NULL` |
| `intervention_reason` | `TEXT` |
| `final_score` | `DECIMAL(5,2)` |
| `finalization_comment` | `VARCHAR(2000)` |
| `finalized_at` | `TIMESTAMPTZ` |
| `finalized_by` | `UUID` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMPTZ NOT NULL` |

```sql
ALTER TABLE submissions ADD CONSTRAINT "submissions_pkey" PRIMARY KEY ("id");
ALTER TABLE submissions ADD CONSTRAINT "submissions_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "submissions_assessment_id_learner_id_submission_number_key" ON "submissions"("assessment_id", "learner_id", "submission_number");
CREATE INDEX IF NOT EXISTS "submissions_cycle_id_idx" ON "submissions"("cycle_id");
```

### `peer_review_cycles`

| Column | PostgreSQL definition |
| --- | --- |
| `id` | `UUID NOT NULL` |
| `organization_id` | `UUID NOT NULL` |
| `assessment_id` | `UUID NOT NULL` |
| `opens_at` | `TIMESTAMPTZ NOT NULL` |
| `closes_at` | `TIMESTAMPTZ NOT NULL` |
| `review_due_at` | `TIMESTAMPTZ NOT NULL` |
| `reviewers_per_submission` | `SMALLINT NOT NULL` |
| `score_gap` | `DECIMAL(5,2) NOT NULL` |
| `reminder_hours` | `INTEGER NOT NULL` |
| `status` | `TEXT NOT NULL` |
| `reviewer_permutation` | `UUID[]` |
| `closed_at` | `TIMESTAMPTZ` |
| `reminded_at` | `TIMESTAMPTZ` |
| `completed_at` | `TIMESTAMPTZ` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMPTZ NOT NULL` |

```sql
ALTER TABLE peer_review_cycles ADD CONSTRAINT "peer_review_cycles_pkey" PRIMARY KEY ("id");
ALTER TABLE peer_review_cycles ADD CONSTRAINT "peer_review_cycles_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

### `submission_reviews`

| Column | PostgreSQL definition |
| --- | --- |
| `id` | `UUID NOT NULL` |
| `organization_id` | `UUID NOT NULL` |
| `submission_id` | `UUID NOT NULL` |
| `cycle_id` | `UUID` |
| `reviewer_id` | `UUID NOT NULL` |
| `reviewer_role` | `TEXT NOT NULL` |
| `status` | `TEXT NOT NULL` |
| `score` | `DECIMAL(5,2)` |
| `comment` | `VARCHAR(2000)` |
| `completed_at` | `TIMESTAMPTZ` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMPTZ NOT NULL` |

```sql
ALTER TABLE submission_reviews ADD CONSTRAINT "submission_reviews_pkey" PRIMARY KEY ("id");
ALTER TABLE submission_reviews ADD CONSTRAINT "submission_reviews_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE submission_reviews ADD CONSTRAINT "submission_reviews_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "peer_review_cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "submission_reviews_organization_id_reviewer_id_idx" ON "submission_reviews"("organization_id", "reviewer_id");
CREATE INDEX IF NOT EXISTS "submission_reviews_submission_id_idx" ON "submission_reviews"("submission_id");
CREATE INDEX IF NOT EXISTS "submission_reviews_cycle_id_status_idx" ON "submission_reviews"("cycle_id", "status");
```

### `submission_review_scores`

| Column | PostgreSQL definition |
| --- | --- |
| `id` | `UUID NOT NULL` |
| `organization_id` | `UUID NOT NULL` |
| `review_id` | `UUID NOT NULL` |
| `criterion_id` | `UUID NOT NULL` |
| `points` | `SMALLINT NOT NULL` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMPTZ NOT NULL` |

```sql
ALTER TABLE submission_review_scores ADD CONSTRAINT "submission_review_scores_pkey" PRIMARY KEY ("id");
ALTER TABLE submission_review_scores ADD CONSTRAINT "submission_review_scores_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "submission_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE submission_review_scores ADD CONSTRAINT "submission_review_scores_criterion_id_fkey" FOREIGN KEY ("criterion_id") REFERENCES "rubric_criteria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "submission_review_scores_review_id_criterion_id_key" ON "submission_review_scores"("review_id", "criterion_id");
```

### `learner_accounts`

| Column | PostgreSQL definition |
| --- | --- |
| `user_id` | `UUID NOT NULL` |
| `organization_id` | `UUID NOT NULL` |
| `deactivated_at` | `TIMESTAMPTZ` |
| `deleted_at` | `TIMESTAMPTZ` |
| `status_as_of` | `TIMESTAMPTZ NOT NULL` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMPTZ NOT NULL` |

```sql
ALTER TABLE learner_accounts ADD CONSTRAINT "learner_accounts_pkey" PRIMARY KEY ("user_id");
```

### `platform_settings`

| Column | PostgreSQL definition |
| --- | --- |
| `id` | `UUID NOT NULL` |
| `default_peer_review_cycle_days` | `INTEGER NOT NULL DEFAULT 7` |
| `default_peer_review_deadline_days` | `INTEGER NOT NULL DEFAULT 3` |
| `peer_review_reminder_hours` | `INTEGER NOT NULL DEFAULT 24` |
| `default_max_consecutive_attempts` | `INTEGER NOT NULL DEFAULT 3` |
| `default_lockout_hours` | `INTEGER NOT NULL DEFAULT 24` |
| `source_as_of` | `TIMESTAMPTZ NOT NULL` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMPTZ NOT NULL` |

```sql
ALTER TABLE platform_settings ADD CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id");
```

### `outbox_events`

| Column | PostgreSQL definition |
| --- | --- |
| `id` | `UUID NOT NULL` |
| `aggregate_type` | `TEXT NOT NULL` |
| `aggregate_id` | `UUID NOT NULL` |
| `event_type` | `TEXT NOT NULL` |
| `organization_id` | `UUID` |
| `payload` | `JSONB NOT NULL` |
| `occurred_at` | `TIMESTAMPTZ NOT NULL` |
| `published_at` | `TIMESTAMPTZ` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMPTZ NOT NULL` |
| `attempts` | `INTEGER NOT NULL DEFAULT 0` |
| `last_error` | `TEXT` |
| `next_attempt_at` | `TIMESTAMPTZ` |

```sql
ALTER TABLE outbox_events ADD CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id");
CREATE INDEX "outbox_events_published_at_idx" ON "outbox_events"("published_at");
```

## Provided to other services

- The [Assessment API](../../contracts/openapi/assessment-service.yaml) exposes the completion snapshot, assessment results and assignment activity.
- The [assessment activity controller](../../services/assessment-service/src/modules/assessment-activity/assessment-activity.controller.ts) also reports activity beyond assignments.
- The [status and peer review contracts](../../contracts/events/README.md) describe both Assessment Kafka streams. Assignment-minute totals go to Course over the [Course internal controller](../../services/course-service/src/modules/internal-courses/internal-courses.controller.ts).
