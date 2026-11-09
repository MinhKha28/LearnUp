# tenant-service

NestJS + Prisma 7 service for LearnUP.

Database: `tenant_db`
Port: `8084`

The Prisma schema follows `LearnUP_Database_Guide.docx` service ownership and table boundaries.

## First Admin on an empty stack

A new stack has no account to sign in with. `dist/src/bootstrap/bootstrap-admin.js` creates only what an Admin needs to start: the default `platform_settings` row (if there is none) and one Active Admin account in tenant (`organization_id` NULL), then sets its password through Identity's authenticated internal channel (`POST /api/internal/credentials` with `x-internal-key`), the same channel tenant uses after an account is activated. It creates no Subscription Plan, Organization or other business data: the Admin creates plans through UC43.1.

The password is read only from `ADMIN_PASSWORD` (12 to 128 characters, no leading or trailing spaces), is never printed and is not stored in tenant. Identity has no public port, so run the command inside the tenant container, which already has `DATABASE_URL`, `IDENTITY_SERVICE_URL` and `INTERNAL_SERVICE_KEY`:

```powershell
docker compose up -d --wait tenant-service identity-service
docker compose exec -e ADMIN_EMAIL=admin@your-domain.vn -e ADMIN_PASSWORD tenant-service node dist/src/bootstrap/bootstrap-admin.js
```

`-e ADMIN_PASSWORD` without a value passes the variable of your shell, so set it first (`$env:ADMIN_PASSWORD = Read-Host -MaskInput` in PowerShell 7; `$env:ADMIN_PASSWORD = [Net.NetworkCredential]::new('', (Read-Host -AsSecureString)).Password` in Windows PowerShell 5.1; `read -rs ADMIN_PASSWORD; export ADMIN_PASSWORD` in bash) and remove it afterwards. `ADMIN_FULL_NAME` is optional (default "Quản trị viên LearnUP").

Without Docker, with identity-service running locally: `npm run build`, then `node --env-file=.env dist/src/bootstrap/bootstrap-admin.js` with `ADMIN_EMAIL` and `ADMIN_PASSWORD` set.

Running it again with the same email keeps the Admin and only sets the password again, so it also resets a forgotten Admin password. It refuses an email that belongs to a non-Admin account, an Admin account that is not Active, and a second Admin email unless `ADMIN_ALLOW_ADDITIONAL=true`. If Identity cannot be reached, the tenant row is kept and the command exits 1; run it again.

## Email verification key (`EMAIL_OTP_SECRET`)

tenant stores the 6-digit email verification codes only as an HMAC with this key (BR-13), so the key must be private to each machine. tenant refuses to start when it is missing, blank or shorter than 32 bytes, and names the variable in the error. Other services and Compose commands that do not start tenant (for example Kafka only) do not need it.

Generate one and add it to the root `.env` (for Docker Compose) and to `services/tenant-service/.env` (for `npm run start:dev`):

```powershell
node -e "console.log('EMAIL_OTP_SECRET=' + require('crypto').randomBytes(32).toString('base64url'))"
```

Changing the key invalidates the codes already sent; a Guest asks for a new code. Reopen links do not use this key and keep working. `scripts/inter1-demo.mjs` and `tests/e2e/cluster/start.sh` generate a key for the run when none is set.

## Email relay (outbox)

Emails are written to `outbox_events` (`event_type = 'EmailRequested'`) in the same transaction as the business data, then sent to notification-service by `EmailRelayService` every second (up to 20 per round, `FOR UPDATE SKIP LOCKED`).

- A failed send increments `attempts`, stores a fixed `last_error_code` and schedules `next_attempt_at` (5 s, doubling, capped at 10 minutes).
- The 8th failure sets `failed_at`; the relay no longer picks that row up.
- An email whose `payload.expiresAt` has passed is not sent: the relay sets `failed_at`, `last_error_code = 'EXPIRED'` and redacts the payload without counting an attempt. Set: verification email = OTP expiry (BR-13), reopen-link email = registration expiry, invitation = link expiry (BR-30); the activation notice has none.
- Delivery is at-least-once: if the result cannot be committed after notification-service accepted the email, the email may be sent again.
- `NOTIFICATION_SERVICE_TIMEOUT_MS` (default `5000`) bounds each HTTP call. Without `NOTIFICATION_SERVICE_URL`, emails stay pending; only `NODE_ENV=development` prints them to the log instead.

To resend an email that reached `failed_at` (for example after fixing SMTP), reset it in `tenant_db`:

```sql
UPDATE outbox_events
SET failed_at = NULL, attempts = 0, next_attempt_at = NULL, last_error_code = NULL
WHERE id = '<event id from the log>' AND published_at IS NULL;
```

Check that the email is still useful first: an OTP expires after 10 minutes (BR-13), and an invitation link has its own expiry (BR-30). Rows with `last_error_code = 'EXPIRED'` have no content left and stay skipped after a reset.
