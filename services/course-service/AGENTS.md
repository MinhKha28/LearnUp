# Course instructions

Own Course content, versions, lessons and materials. Learning owns learner enrollment/assignment.

Run npm ci after building the file-linked libraries declared in package.json.
Use npx prisma generate --config prisma7.config.ts after schema/dependency changes.
For manual Prisma commands use --config prisma7.config.ts; where ts-node needs module
resolution set NODE_PATH to this service directory for that invocation. Run npm run
build and the indicated suites from this directory. Use the CI ESLint command without
--fix for read-only lint. Read README.md for database/environment prerequisites.

Verification: npm test -- --ci; npm run test:e2e.

For real Course contract checks use a dedicated isolated deployment; never assume workstation-specific ports or containers.
