# LearnUP Frontend

Frontend application for **LearnUP — Organization Training Management Platform**, a B2B SaaS platform for organizations to manage internal training, courses, assessments, learner progress, certificates, subscriptions, and related operational workflows.

This repository contains the **React + TypeScript frontend** only. It communicates with the LearnUP backend through HTTP APIs.

---

## Overview

LearnUP is designed for organizational training rather than a public course marketplace.

The frontend is organized around five primary roles:

- **Guest** — public website, authentication, organization registration, plan selection, payment and account activation flows.
- **Admin** — platform administration, organizations, plans, configuration and moderation.
- **Organizer** — organization members, course approval, assignments, progress, reports, subscription and organization settings.
- **Instructor** — course creation, course versions, assessments, grading, peer review and learner monitoring.
- **Learner** — required training, optional courses, learning progress, assessments and certificates.

The UI follows the LearnUP design system and approved Figma designs.

---

## Tech Stack

| Category | Technology |
| --- | --- |
| Framework | React 18 |
| Language | TypeScript |
| Build Tool | Vite |
| Routing | React Router DOM |
| UI Library | Ant Design |
| HTTP Client | Axios |
| Styling | SCSS |
| Date Handling | Day.js |
| Icons | Ant Design Icons / React Icons |
| Linting | ESLint |

Additional packages are available for spreadsheet handling, CSV export, image galleries, device detection, loading indicators and utility use cases.

---

## Getting Started

### Prerequisites

Install:

- Node.js
- npm

### Install dependencies

```bash
npm install
```

### Environment configuration

Tenant, course and assessment services each have their own base URL variable, read in `src/config/env.ts`.
The app fails at startup with a clear error if any of them is missing.
Identity and the learner pages (catalog, enrollments) still use `VITE_BACKEND_URL`.

```env
VITE_BACKEND_URL=http://localhost:8080
VITE_TENANT_BACKEND_URL=http://localhost:8084
VITE_COURSE_BACKEND_URL=http://localhost:8083
VITE_ASSESSMENT_BACKEND_URL=http://localhost:8086
```

Copy them from `.env.example` into `.env.development.local` (not committed).
When going through the api-gateway, point all of them at `http://localhost:8080`.

### Run development server

```bash
npm run dev
```

### Build production bundle

```bash
npm run build
```

### Run lint

```bash
npm run lint
```

### Preview production build

```bash
npm run preview
```

---

## Project Structure

```text
src/
├── assets/
│   ├── images/
│   ├── icons/
│   └── template/
│
├── components/
│   ├── admin/
│   ├── context/
│   ├── guest/
│   ├── identity/
│   ├── instructor/
│   ├── layout/
│   │   ├── header.tsx
│   │   ├── header.scss
│   │   ├── footer.tsx
│   │   ├── footer.scss
│   │   ├── layout.admin.tsx
│   │   ├── layout.organizer.tsx
│   │   ├── layout.instructor.tsx
│   │   └── layout.learner.tsx
│   ├── learner/
│   └── organizer/
│
├── pages/
│   ├── admin/
│   ├── guest/
│   ├── instructor/
│   ├── learner/
│   └── organizer/
│
├── services/
│   ├── achievement.service.ts
│   ├── assessment.service.ts
│   ├── axios.customize.ts
│   ├── course.service.ts
│   ├── identity.service.ts
│   ├── learning.service.ts
│   ├── notification.service.ts
│   └── organization.service.ts
│
├── styles/
│   └── global.scss
│
├── types/
│   ├── achievement.types.ts
│   ├── assessment.types.ts
│   ├── axios.d.ts
│   ├── course.types.ts
│   ├── file.d.ts
│   ├── global.d.ts
│   ├── identity.types.ts
│   ├── learning.types.ts
│   └── organization.types.ts
│
├── utils/
│   └── helper.ts
│
├── layout.tsx
├── main.tsx
├── router.tsx
└── vite-env.d.ts
```

The project intentionally keeps the structure simple and avoids unnecessary architectural layers.

---

## Architecture Rules

### Pages

Route-level screens belong in:

```text
pages/<role>/
```

Examples:

```text
pages/guest/home.tsx
pages/guest/login.tsx
pages/admin/dashboard.tsx
pages/instructor/course-builder.tsx
```

### Components

Reusable role-specific UI belongs in:

```text
components/<role>/
```

Shared application layout components belong in:

```text
components/layout/
```

Authentication and authorization UI helpers belong in:

```text
components/identity/
```

### Services

API calls are grouped by business domain:

```text
identity.service.ts
organization.service.ts
course.service.ts
learning.service.ts
assessment.service.ts
achievement.service.ts
notification.service.ts
```

Shared Axios configuration is kept in:

```text
services/axios.customize.ts
```

### Types

Domain types use:

```text
<domain>.types.ts
```

Examples:

```text
course.types.ts
learning.types.ts
assessment.types.ts
```

`global.d.ts` is reserved for truly application-wide generic declarations.

---

## Routing

All main route definitions are kept directly in:

```text
src/router.tsx
```

At the current stage, LearnUP does **not** use a `constants/routes.ts` file.

Example:

```tsx
{
  path: "/login",
  element: <LoginPage />,
}
```

Use nested routes and relative child paths where appropriate.

---

## Application Providers

Global application providers belong in:

```text
src/main.tsx
```

Current structure:

```tsx
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App>
      <AppProvider>
        <ConfigProvider locale={enUS}>
          <RouterProvider router={router} />
        </ConfigProvider>
      </AppProvider>
    </App>
  </StrictMode>
);
```

Rules:

- Do not duplicate `ConfigProvider` inside layouts or pages.
- Do not duplicate `AppProvider` inside role layouts.
- Keep global provider configuration in `main.tsx`.
- LearnUP visual tokens are managed in `styles/global.scss`.
- Do not move LearnUP colors into `ConfigProvider` unless a true application-wide Ant Design theme override is required.

---

## Layout Convention

`src/layout.tsx` should remain focused on page composition.

Typical responsibility:

```tsx
return (
  <>
    <Header />
    <Outlet />
    <Footer />
  </>
);
```

If layout-level state is genuinely required, keep it minimal.

Layouts should not contain:

- global provider configuration
- page-specific API logic
- page-specific form logic
- large business logic
- unrelated feature state

---

## File Naming Convention

LearnUP uses **lowercase filenames**.

### Pages and components

Use lowercase and `kebab-case` for multiple words:

```text
home.tsx
course-detail.tsx
course-builder.tsx
member-table.tsx
progress-summary.tsx
```

Avoid:

```text
Home.tsx
CourseBuilder.tsx
course_builder.tsx
courseBuilder.tsx
```

### Role layouts

Use dot naming:

```text
layout.admin.tsx
layout.organizer.tsx
layout.instructor.tsx
layout.learner.tsx
```

### Services

```text
<domain>.service.ts
```

Example:

```text
course.service.ts
```

### Types

```text
<domain>.types.ts
```

Example:

```text
course.types.ts
```

### Folders

Use lowercase names:

```text
guest/
admin/
organizer/
instructor/
learner/
```

Use `kebab-case` when a folder needs multiple words:

```text
course-builder/
peer-review/
member-management/
```

Do not create a new folder when one simple file is sufficient.

---

## SCSS Convention

LearnUP uses **regular SCSS**, not CSS Modules.

Use:

```text
header.tsx
header.scss

login.tsx
login.scss

course-builder.tsx
course-builder.scss
```

Do not use:

```text
header.module.scss
login.module.scss
```

Import styles directly:

```ts
import "./header.scss";
```

### Class naming

Use simple prefixed `kebab-case` class names.

Example:

```scss
.header {}
.header-title {}
.header-logo {}
.header-nav {}
.header-actions {}

.login {}
.login-title {}
.login-form {}
.login-submit {}
```

Do not use BEM double-underscore naming:

```scss
.header__title {}
.login__form {}
```

Avoid generic global names such as:

```text
.title
.wrapper
.content
.item
.button
```

Class names should clearly identify the owning page or component.

---

## Global Styles

`src/styles/global.scss` is reserved for application-wide foundations.

Typical responsibilities:

- reset / `box-sizing`
- `html`, `body`, `#root`
- Inter font stack
- LearnUP design tokens
- base text and background
- form-control font inheritance
- global focus behavior
- truly shared utility rules

Page-specific styles should remain in their own SCSS files.

Example LearnUP tokens:

```scss
:root {
  --color-primary: #1e293b;
  --color-accent: #f59e0b;

  --color-bg: #f8fafc;
  --color-surface: #ffffff;
  --color-surface-secondary: #f1f5f9;

  --color-border: #e2e8f0;
  --color-divider: #cbd5e1;

  --color-text-primary: #0f172a;
  --color-text-secondary: #475569;

  --color-success: #059669;
  --color-info: #2563eb;
  --color-warning: #f59e0b;
  --color-error: #dc2626;
}
```

---

## Design System

LearnUP uses a professional B2B SaaS visual direction.

### Brand

| Token | Value |
| --- | --- |
| Primary Navy | `#1E293B` |
| Accent Amber | `#F59E0B` |
| Background | `#F8FAFC` |
| Surface | `#FFFFFF` |
| Secondary Surface | `#F1F5F9` |
| Border | `#E2E8F0` |
| Primary Text | `#0F172A` |
| Secondary Text | `#475569` |
| Success | `#059669` |
| Info | `#2563EB` |
| Error | `#DC2626` |

Primary typography:

```text
Inter
```

The product should remain:

- professional
- trustworthy
- modern
- structured
- enterprise-oriented
- approachable
- easy to scan

Avoid excessive gradients, glassmorphism, neon effects, decorative shadows, oversized radii and unnecessary animation.

---

## Figma

Approved LearnUP design reference:

<https://www.figma.com/design/5SCWdZisvCvQ64B9a0or9N/LearnUP?node-id=0-1>

When implementing UI:

1. inspect the target Figma screen;
2. identify existing reusable components;
3. match layout, typography, spacing, colors, borders and states;
4. implement with the existing project stack;
5. compare the result with Figma;
6. fix meaningful visual differences before finishing.

Figma is the visual source of truth for approved screens.

---

## Ant Design

Use Ant Design components where they fit the design.

Common examples:

```text
Button
Form
Input
Select
Table
Modal
Drawer
Dropdown
Tooltip
Pagination
DatePicker
Upload
Tag
```

Do not rebuild common UI primitives without a clear design reason.

Ant Design should be styled to match LearnUP rather than allowing default library styling to dictate the product design.

---

## Import Convention

Use the `@/` alias for cross-folder imports.

Example:

```ts
import Header from "@/components/layout/header";
import axios from "@/services/axios.customize";
import type { ICourse } from "@/types/course.types";
```

Avoid unnecessary deep relative imports.

---

## UI States

Data-driven screens should consider relevant states:

- Loading
- Empty
- Error
- Success
- Confirmation

Forms should also support relevant:

- validation
- loading
- disabled
- submission error states

---

## Responsive Design

Reference widths:

```text
1440px
1280px
768px
375px
```

Responsive UI should adapt layout rather than simply shrinking the desktop design.

Typical behavior includes:

- collapsed navigation
- stacked content
- preserved primary CTA
- horizontally scrollable data tables where necessary
- reduced secondary content
- no unintended horizontal overflow

---

## Development Guidelines

Before introducing a new dependency:

1. check whether the existing stack already solves the problem;
2. prefer Ant Design where suitable;
3. prefer native React, TypeScript and browser APIs for simple use cases.

Avoid unnecessary complexity.

Do not introduce:

- Redux
- Zustand
- TanStack Query
- repository layers
- adapter layers
- feature-folder architecture
- extra design abstractions

unless the project has a real requirement for them.

---

## AI / Codex Skills

Repository-specific implementation rules are stored under:

```text
.agents/
└── skills/
    ├── learnup-frontend/
    │   └── SKILL.md
    └── learnup-ui-design/
        └── SKILL.md
```

`AGENTS.md` provides the entry-level instructions for AI-assisted development.

When using Codex or another coding agent for Figma-to-code work, both LearnUP skills should be followed.

---

## Quality Checklist

Before completing a frontend task:

- follow the current folder structure;
- use the correct role folder;
- follow filename conventions;
- use regular SCSS, not CSS Modules;
- use prefixed SCSS class names;
- keep providers in `main.tsx`;
- keep layouts focused on composition;
- keep routes in `router.tsx`;
- avoid unnecessary `any`;
- avoid unrelated refactors;
- run TypeScript/build checks;
- run lint when relevant;
- verify responsive behavior;
- compare UI against approved Figma where applicable.

---

## Available Scripts

### Password recovery (UC07)

Forgot Password and `/reset-password/:token` use the existing Identity client and
`VITE_BACKEND_URL`, which must point to the configured API Gateway, not private
Identity/Notification ports. No new frontend environment variable or internal
service credential is required. Do not put backend secrets into `VITE_*` values.

The pages call `POST /api/v1/auth/forgot-password` with `{email}` and
`POST /api/v1/auth/reset-password` with `{token,newPassword,confirmPassword}`.
Recovery helpers retain the real HTTP status and validate Identity's
`{success,data,error}` envelope. Narrow request options prevent the shared Axios
interceptors from refreshing/replaying these public operations; authentication
headers and development fake identity are not used. Global Axios/session/context
code is unchanged. A resolved HTTP error is never confirmation of success.

Forgot Password displays the same neutral accepted-request message for eligible
and unknown accounts. It does not promise inbox arrival. Reset shows success only
after the backend replaces the password, does not sign in automatically, and
offers a new recovery request when a link is invalid, expired, used or revoked.
Password validation follows the current backend minimum (6 characters) and
BCrypt's 72-byte limit; confirmation reuses the existing change-password rule.
The backend remains authoritative for token validity and access policy.

The existing auth cards, SCSS, controls and routes are preserved. An early
reset-route-only `no-referrer` policy protects resource requests before React
mounts, including the existing external font, without changing typography.
Reset also applies that policy for client-side entry. The production Nginx
configuration redacts reset URLs in access-log request/referrer fields while
retaining ordinary request diagnostics. Keep equivalent redaction and referrer
protection in any external proxy/APM; the initial token URL necessarily reaches
the frontend host. Never capture form bodies, recovery URLs or tokens in
analytics, console output, screenshots or support reports.

Verification uses the existing Vitest setup. The opt-in browser suite launches
an owned headless Chrome, disposable Vite server and a synthetic HTTP Gateway;
it never uses shared accounts/databases or development fake authentication:

```powershell
npm test
$env:LEARNUP_RECOVERY_BROWSER_TESTS = '1'
npm test -- dev/password.recovery.browser.test.ts
Remove-Item Env:LEARNUP_RECOVERY_BROWSER_TESTS
npm run build
```

The opt-in suite needs Node 22+ and installed Chrome (or `CHROME_PATH`). Browser HTTP tests
are mocked-backend verification, not deployed Identity/SMTP/Tenant integration.
Real recovery email still requires ID-P3's private configuration, enabled SMTP
and a frontend base URL matching this application. See Identity's development
guide for backend delivery limits and its explicitly documented crash/retry risks.
The Nginx access-log maps do not sanitize server error logs or external proxy/APM
capture; deployment operators must keep those from retaining recovery URLs too.

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

---

## License

No license has been defined in this repository yet.
