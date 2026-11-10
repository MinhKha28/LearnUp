# Contributing

## Database and contract changes

This rule applies to a pull request that:
- adds a database migration in any service, or
- removes, renames, or changes the type or nullability of an API or event field that another service or the frontend reads.

Adding a new field is not a breaking change and does not trigger this rule.

When it applies, the author:
1. Adds the label `db-migration` (and `contract` when an API or event field changes).
2. Fills the "Database changes" and "Breaking contract changes" sections of the pull request description (from `.github/pull_request_template.md`). Pull requests without such changes write "None".
3. Posts in the team Zalo group twice:
   - when opening the pull request, so the team can comment on the schema before merge;
   - when it is merged, with the steps to run after pulling (for example migrate and `npx prisma generate` in the affected services).
4. Updates the database design document of the service, or writes "N/A" in "Design docs updated".

### Opening a pull request from the command line

`gh pr create --body` and `--body-file` replace the template. Use
`gh pr create --template .github/pull_request_template.md`, or copy both sections into your prepared body.
