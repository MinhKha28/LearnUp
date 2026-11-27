# @learnup/ts-common

Framework-neutral TypeScript types and helpers shared by LearnUP components. This
package contains technical contracts, not Course business logic or a NestJS server.
For Course database setup and startup, use the [Course README](../../services/course-service/README.md).

## Public surface

The package entry point is [src/index.ts](src/index.ts). Its modules expose:

| Module | Examples |
| --- | --- |
| API | ApiResponse, ApiErrorResponse, PageResponse, createPageResponse, error helpers |
| Auth | UserRole, USER_ROLES, parseUserRole and role validation |
| Context | HEADER_NAMES, CurrentUser, RequestContext and context factories |
| Events | EventEnvelope, createEventEnvelope, and the outbox relay diagnostics OUTBOX_TOPIC_MISSING, isKafkaTopicMissing, OUTBOX_UNKNOWN and classifyKafkaRelayError |

Import from the package entry point; package.json maps the ESM entry and declaration
files to dist/. Do not import a consumer's guards, interceptors, controllers, Prisma
models or framework-specific decorators into this library.

```ts
import { createPageResponse, parseUserRole } from '@learnup/ts-common';
import type { ApiResponse } from '@learnup/ts-common';

const role = parseUserRole('LEARNER');
const page = createPageResponse([{ id: 'example-item' }], 1, 20, 1);
const response: ApiResponse<typeof page> = {
  statusCode: 200,
  message: 'Items retrieved',
  data: page,
};
```

Role parsing and context factories transform data; they do not authenticate an
untrusted request. The consuming service supplies its authenticated context.
Event-specific contracts remain in [contracts/events/](../../contracts/events/README.md).

## Node-only security helper

Server code can import `constantTimeSecretEqual` from
`@learnup/ts-common/security` to authenticate an internal service credential.
It compares SHA-256 digests with Node crypto, preserves whitespace in valid
credentials, and rejects empty or invalid inputs and blank configured keys.
Keep this subpath out of browser code; the root entry does not export it.
Build the library before installing or building its file-linked consumers.

## Local development

Use the Node version selected by the current CI workflow. From libraries/ts-common/:

```sh
npm ci
npm run build
npm run typecheck
npm test
```

The prepare hook also builds on installation. The scripts and exports in
[package.json](package.json) are authoritative. There is no library lint, Prisma or
server-start script. dist/ is generated output and must not be committed.

## File-linked consumers

Services reference this library through a file: dependency, for example
file:../../libraries/ts-common. Build the library before installing/building those
consumers so declarations and ESM output exist. Search all package manifests rather
than assuming a fixed consumer list.

When changing a public type or helper, rebuild the library fresh, then check every
consumer with both its build and default TypeScript configuration and its relevant
regression tests. Report advisory checks or known failures explicitly; do not treat
a successful service build as proof that its default test configuration typechecks.
No root npm install or workspace package is required.
