# Prepare local demo fixtures

Use a disposable database and local service configuration. The [PowerShell launcher](../../scripts/inter2-demo.ps1) provisions PostgreSQL 16 on port `15433` by default and runs the [demo setup script](../../scripts/inter1-demo.mjs). Use Node 22 and Docker with the dependencies required by that launcher. Keep storage credentials in the local environment for provider-backed assets.

```powershell
powershell -ExecutionPolicy Bypass -File scripts/inter2-demo.ps1 -AnyBranch
```

The launcher runs the Learning `seed:demo` and Assessment `db:seed:withdrawal-demo` commands as part of its HTTP setup. For the fixture definitions, see the [Tenant account seed](../../services/tenant-service/prisma/seed-account-management.ts), [withdrawal seed](../../services/learning-service/prisma/withdrawal-demo-fixture.ts) and [video seed](../../services/learning-service/prisma/video-demo-fixture.ts).

| Fixture | ID |
| --- | --- |
| Organization ABC | `01900000-0000-7000-8000-00000000a001` |
| Organization XYZ | `01900000-0000-7000-8000-00000000b001` |
| Organizer, ABC | `01900000-0000-7000-8000-00000000a010` |
| Học viên 1, ABC | `01900000-0000-7000-8000-00000000a201` |
| Học viên 2, ABC | `01900000-0000-7000-8000-00000000a202` |
| Học viên 3, XYZ | `01900000-0000-7000-8000-00000000b201` |
| Học viên 4, ABC | `01900000-0000-7000-8000-00000000a206` |
| Withdrawal course X and enrollment | `01900000-0000-7000-8000-c0020000005c`, `01900000-0000-7000-8000-2a0000000004` |
| Withdrawal course Y and enrollment | `01900000-0000-7000-8000-c00200000097`, `01900000-0000-7000-8000-2a0000000005` |
| Video course and material (601 seconds) | `01900000-0000-7000-8000-c0020000005c`, `01900000-0000-7000-8000-c0050001676b` |
| Video enrollments | `01900000-0000-7000-8000-2a0000000027`, `01900000-0000-7000-8000-2a0000000028` |

For load fixtures and runs, use the [Learning benchmark guide](../../perf/learning/README.md).
