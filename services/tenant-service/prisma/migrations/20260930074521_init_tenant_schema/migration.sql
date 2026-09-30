-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "tax_code" VARCHAR(13) NOT NULL,
    "address" VARCHAR(300) NOT NULL,
    "contact_phone" VARCHAR(16) NOT NULL,
    "contact_email" VARCHAR(254),
    "logo_file_key" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "email" VARCHAR(254) NOT NULL,
    "full_name" VARCHAR(100) NOT NULL,
    "avatar_file_key" TEXT,
    "role" TEXT NOT NULL,
    "department" VARCHAR(100),
    "status" TEXT NOT NULL,
    "activated_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_tokens" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "purpose" TEXT NOT NULL,
    "token_hash" BYTEA NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "consumed_at" TIMESTAMPTZ,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "account_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "price" BIGINT NOT NULL,
    "duration_days" INTEGER NOT NULL,
    "max_learners" INTEGER NOT NULL,
    "max_instructors" INTEGER NOT NULL,
    "max_course_chains" INTEGER NOT NULL,
    "max_storage_bytes" BIGINT NOT NULL,
    "is_offered" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registrations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "organizer_user_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "price" BIGINT NOT NULL,
    "duration_days" INTEGER NOT NULL,
    "max_learners" INTEGER NOT NULL,
    "max_instructors" INTEGER NOT NULL,
    "max_course_chains" INTEGER NOT NULL,
    "max_storage_bytes" BIGINT NOT NULL,
    "status" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "paid_at" TIMESTAMPTZ,
    "reopen_token_hash" BYTEA,
    "resend_count" INTEGER NOT NULL DEFAULT 0,
    "resend_window_started_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "price" BIGINT NOT NULL,
    "duration_days" INTEGER NOT NULL,
    "max_learners" INTEGER NOT NULL,
    "max_instructors" INTEGER NOT NULL,
    "max_course_chains" INTEGER NOT NULL,
    "max_storage_bytes" BIGINT NOT NULL,
    "starts_at" TIMESTAMPTZ NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "grace_ends_at" TIMESTAMPTZ,
    "suspended_at" TIMESTAMPTZ,
    "read_only_ends_at" TIMESTAMPTZ,
    "ended_at" TIMESTAMPTZ,
    "last_reminder_days" INTEGER,
    "certificate_reminder_sent_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "registration_id" UUID,
    "amount" BIGINT NOT NULL,
    "status" TEXT NOT NULL,
    "subscription_id" UUID,
    "provider_reference" TEXT,
    "failure_reason" TEXT,
    "paid_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_suspensions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL,
    "ended_at" TIMESTAMPTZ,
    "reason" VARCHAR(1000) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "organization_suspensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "id" UUID NOT NULL,
    "pending_registration_ttl_hours" INTEGER NOT NULL DEFAULT 168,
    "subscription_grace_days" INTEGER NOT NULL DEFAULT 7,
    "organizer_read_only_days" INTEGER NOT NULL DEFAULT 30,
    "usage_warning_threshold_percent" INTEGER NOT NULL DEFAULT 80,
    "reading_speed_words_per_minute" INTEGER NOT NULL DEFAULT 200,
    "study_minutes_per_day" INTEGER NOT NULL DEFAULT 60,
    "duration_gap_threshold_percent" INTEGER NOT NULL DEFAULT 20,
    "video_completion_percent" INTEGER NOT NULL DEFAULT 90,
    "report_handling_days" INTEGER NOT NULL DEFAULT 7,
    "instructor_violation_threshold" INTEGER NOT NULL DEFAULT 3,
    "evaluation_form_days" INTEGER NOT NULL DEFAULT 14,
    "default_peer_review_cycle_days" INTEGER NOT NULL DEFAULT 7,
    "default_peer_review_deadline_days" INTEGER NOT NULL DEFAULT 3,
    "peer_review_reminder_hours" INTEGER NOT NULL DEFAULT 24,
    "default_max_consecutive_attempts" INTEGER NOT NULL DEFAULT 3,
    "default_lockout_hours" INTEGER NOT NULL DEFAULT 24,
    "max_video_size_bytes" BIGINT NOT NULL DEFAULT 2147483648,
    "max_video_duration_minutes" INTEGER NOT NULL DEFAULT 120,
    "max_reading_size_bytes" BIGINT NOT NULL DEFAULT 52428800,
    "allowed_video_mime_types" TEXT[] DEFAULT ARRAY['video/mp4']::TEXT[],
    "allowed_reading_mime_types" TEXT[] DEFAULT ARRAY['application/pdf']::TEXT[],
    "max_link_resends_per_24h" INTEGER NOT NULL DEFAULT 5,
    "invitation_link_ttl_days" INTEGER NOT NULL DEFAULT 7,
    "subscription_reminder_days" INTEGER[] DEFAULT ARRAY[7, 1]::INTEGER[],
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "organization_id" UUID,
    "payload" JSONB NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL,
    "published_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "users_organization_id_idx" ON "users"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_not_deleted_key" ON "users"("email") WHERE (deleted_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "users_one_organizer_per_org_key" ON "users"("organization_id") WHERE (role = 'Organizer' AND deleted_at IS NULL AND status <> 'Deactivated');

-- CreateIndex
CREATE UNIQUE INDEX "account_tokens_token_hash_key" ON "account_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "account_tokens_organization_id_user_id_idx" ON "account_tokens"("organization_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "account_tokens_one_open_link_key" ON "account_tokens"("user_id", "purpose") WHERE (consumed_at IS NULL AND revoked_at IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "registrations_reopen_token_hash_key" ON "registrations"("reopen_token_hash");

-- CreateIndex
CREATE INDEX "registrations_organization_id_idx" ON "registrations"("organization_id");

-- CreateIndex
CREATE INDEX "subscriptions_organization_id_status_idx" ON "subscriptions"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_one_current_per_org_key" ON "subscriptions"("organization_id") WHERE (status IN ('Active', 'Grace', 'Suspended'));

-- CreateIndex
CREATE INDEX "payments_organization_id_idx" ON "payments"("organization_id");

-- CreateIndex
CREATE INDEX "organization_suspensions_organization_id_idx" ON "organization_suspensions"("organization_id");

-- CreateIndex
CREATE INDEX "outbox_events_published_at_idx" ON "outbox_events"("published_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_tokens" ADD CONSTRAINT "account_tokens_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_tokens" ADD CONSTRAINT "account_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_organizer_user_id_fkey" FOREIGN KEY ("organizer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_suspensions" ADD CONSTRAINT "organization_suspensions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
