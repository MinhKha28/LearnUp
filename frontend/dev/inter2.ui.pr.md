# fix(frontend): localize Inter 2 demo UI and improve readability

The Inter 2 learner and organizer flows mixed English and Vietnamese, split learner identity details across narrow columns, and showed misleading course initials and mock organizer identity data. This change makes the assigned screens consistent in Vietnamese and makes assignment status and video completion easier to read during the demo.

## What changed

- Translate the learner/organizer navigation, headers, assigned pages, outcomes and demo persona label in place. Keep `/organizer/assignments` labeled “Phân công đào tạo”.
- Move learner identity details into a full-width row, use three assignment columns, and hide absent completion/withdrawal/deletion details.
- Apply shared status typography/padding tokens only to the three requested screens.
- Clarify watched/required video time and completion state, mark the required threshold, and retain the watched/required percentage calculation. Keep the proxy warning in the developer demo guide.
- Derive course initials from the first Unicode letter or number after leading bracketed prefixes; fall back to the existing icon.
- Reuse the learner demo identity component in the organizer header and use the same existing Demo Organization label; retain the existing authenticated user context.
- Use the installed Vietnamese Ant Design locale for scoped date, selection and pagination controls.
- Update demo output, selectors, guides and regression checks; capture exact 1440px screenshots outside the repository.

## Why

Prepare a readable, consistent interface for the 21 October Inter 2 presentation without changing routes, API contracts, business behavior, backend services or global frontend provider conventions.

## Verification

From `frontend`, run `npm run test`, `npm run build`, and `npm run lint`: the final run passes 298 tests (21 existing browser recovery tests skipped), builds successfully, and reports 0 lint errors with 2 existing react-refresh warnings. Vite retains its bundle-size warning; the tests emit the existing Sass legacy API notice.

From the repository root with a clean checkout, run `powershell -ExecutionPolicy Bypass -File scripts\inter2-demo.ps1 -AnyBranch` until “Sẵn sàng demo”. In another shell, set `CHROME_PATH` to the installed Chromium binary and `DEMO_ARTIFACTS_DIR` to `D:\Temp\learnup-inter2-ui`, then run `node scripts/uc27.2-demo-check.mjs`. The final clean PostgreSQL 16 / real Assessment http run passes all 10 groups. The read-only screenshot group also passes after the final heading translation. All 12 PNGs are exactly 1440px wide; the report lists their paths.

Stop the launcher with Ctrl+C. Both containers created by this verification were removed and ports 3000, 8083–8086 and 15433 were confirmed free. Per the owner's instruction, the pre-existing stopped `learnup-inter2-regression` container and its volume remain untouched.

The two-page learner selection case is covered by the existing unit test, not a 51-account deployed demo. The first browser attempt exposed a Vite optimization reload and selectors that needed scoping after the identity selector/account tag additions; the final full run uses a fresh database and passes. No assertions were relaxed.

## Files shared with other members

- `frontend/src/components/layout/layout.organizer.tsx` and `layout.learner.tsx`: latest prior editor Danh (`987a26d`). Labels and reuse of existing identity display only.
- `frontend/src/components/layout/layout.learner.course.tsx`: latest prior editor DinhVietHao (`d0be7f1`); back-link label.
- `frontend/src/styles/global.scss`: latest prior editor DinhVietHao (`4cf9cd2`); status typography/padding tokens.
- `frontend/dev/identity.proxy.ts` and test: latest prior editor DinhVietHao (`658de25`); display label only, keys and IDs preserved.
- `scripts/inter1-demo.mjs` and `scripts/uc27.2-demo-check.mjs`: latest prior editor DinhVietHao (`72cbf97` / `658de25`); demo wording, selectors and screenshot evidence.

See `frontend/dev/inter2.ui.report.md` for the complete file inventory, old/new checklist labels, screenshot paths and remaining English content outside this scope.
