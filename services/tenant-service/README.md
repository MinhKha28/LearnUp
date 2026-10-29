# tenant-service

NestJS + Prisma 7 service for LearnUP.

Database: `tenant_db`
Port: `8084`

The Prisma schema follows `LearnUP_Database_Guide.docx` service ownership and table boundaries.

## Email relay (outbox)

Emails are written to `outbox_events` (`event_type = 'EmailRequested'`) in the same transaction as the business data, then sent to notification-service by `EmailRelayService` every second (up to 20 per round, `FOR UPDATE SKIP LOCKED`).

- A failed send increments `attempts`, stores a fixed `last_error_code` and schedules `next_attempt_at` (5 s, doubling, capped at 10 minutes).
- The 8th failure sets `failed_at`; the relay no longer picks that row up.
- Delivery is at-least-once: if the result cannot be committed after notification-service accepted the email, the email may be sent again.
- `NOTIFICATION_SERVICE_TIMEOUT_MS` (default `5000`) bounds each HTTP call. Without `NOTIFICATION_SERVICE_URL`, emails stay pending; only `NODE_ENV=development` prints them to the log instead.

To resend an email that reached `failed_at` (for example after fixing SMTP), reset it in `tenant_db`:

```sql
UPDATE outbox_events
SET failed_at = NULL, attempts = 0, next_attempt_at = NULL, last_error_code = NULL
WHERE id = '<event id from the log>' AND published_at IS NULL;
```

Check that the email is still useful first: an OTP expires after 10 minutes (BR-13), and an invitation link has its own expiry (BR-30).
