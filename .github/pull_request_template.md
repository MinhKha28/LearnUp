## What

## Why

## Verification
<!-- Tests run, real checks, and what was NOT verified. -->

## Database changes
<!-- Write "None" if this PR adds no migration.
Otherwise fill every line, add the label `db-migration`, and post in the team Zalo group when opening this PR (schema feedback) and again when it is merged (after-pull steps). -->
- Migration(s):
- Tables / columns:
- Data change (backfill, update, delete):
- Reversible (how):
- After pulling (e.g. migrate + `npx prisma generate` in <service>):
- Affected services:

## Breaking contract changes
<!-- Write "None" unless an API or event field that another service or the frontend reads is removed, renamed, or changes type or nullability. New fields are not breaking.
Otherwise add the label `contract` and list each field, old → new, and its consumers. -->
