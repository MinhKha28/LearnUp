# TypeScript common instructions

Keep the library framework-neutral and technical. Service business rules and
service-specific Prisma/server instructions belong to the owning service.
Search every consumer before changing public contracts. Rebuild the library fresh,
then typecheck every consumer using both build and default configurations.

Run npm ci, npm run build, npm run typecheck and npm test here. prepare also builds
the package. Keep explicit safe exports and do not commit dist/ or generated files.
Read package.json for exports/scripts and README.md for usage. Never introduce a
root npm workspace/install as a shortcut for per-package commands.
