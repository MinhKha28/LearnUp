# Learning instructions

Own Enrollments, progress and completion. Preserve canonical IDs from owning services.

Run npm ci after building the file-linked libraries declared in package.json.
Use npx prisma generate --config prisma7.config.ts after schema/dependency changes.
For manual Prisma commands use --config prisma7.config.ts; where ts-node needs module
resolution set NODE_PATH to this service directory for that invocation. Run npm run
build and the indicated suites from this directory. Use the CI ESLint command without
--fix for read-only lint. Read README.md for database/environment prerequisites.

Verification: npm run test:unit; npm run test:integration.

For any mutation that can make an Enrollment eligible, write completion_evaluation_requests in the same transaction. Use activateEnrollmentSql in src/modules/material-progress/material-progress.repository.ts; first_activity_at must retain the earliest timestamp with LEAST. The integration runner creates an isolated learning_it_* database with a Course stub; npm run test:contract:course is a separate opt-in read-only deployed Course check. Do not run prisma/seed-enrollments.ts before a demo.
