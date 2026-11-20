# Achievement-Reporting instructions

Own certificate issuance and reporting. Preserve source-service snapshot contracts.

Run npm ci after building the file-linked libraries declared in package.json.
Use npx prisma generate --config prisma7.config.ts after schema/dependency changes.
For manual Prisma commands use --config prisma7.config.ts; where ts-node needs module
resolution set NODE_PATH to this service directory for that invocation. Run npm run
build and the indicated suites from this directory. Use the CI ESLint command without
--fix for read-only lint. Read README.md for database/environment prerequisites.

Verification: npm run test:unit; npm run test:integration.

Database suites require a non-production DATABASE_URL and create isolated ar1_test_* schemas with cleanup; never assume a fixed container or port. Do not run destructive probes against shared databases.
