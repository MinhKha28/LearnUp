---
name: learnup-frontend
description: >
  Follow the LearnUP React + TypeScript frontend architecture, folder structure,
  naming conventions, routing, services, types, import aliases, utilities,
  regular SCSS conventions, provider placement, role separation, and
  incremental implementation rules.
---

# LearnUP Frontend Skill

Use this skill whenever creating, modifying, refactoring, or reviewing frontend
code in the LearnUP repository.

## 1. Core principles

- Keep architecture simple, readable, and consistent with the existing repository.
- Extend the current structure instead of redesigning the whole project.
- Prefer incremental changes.
- Only create a new abstraction, folder, hook, utility, service, or shared component when a real use case exists.
- Keep TypeScript strict.
- Avoid `any` unless there is no reasonable type available.
- Do not introduce Redux, Zustand, TanStack Query, repositories, adapters, mappers,
  schemas, feature folders, atomic design, or similar layers unless explicitly required.
- Do not create a `constants/` folder or `routes.ts` at the current stage.

## 2. Technology stack

Use the existing stack:

- React
- TypeScript
- Vite
- React Router
- Ant Design **5.21.6**
- Axios
- SCSS
- Day.js

Do not replace the stack unless explicitly requested.

## Ant Design version rule

The project currently uses:

```text
antd: 5.21.6
```

Rules:

- Write Ant Design code compatible with version **5.21.6**.
- Do not assume APIs, props, components, tokens, or behavior introduced only in later Ant Design versions.
- Before using an unfamiliar Ant Design API, verify that it exists in 5.21.6.
- Do not upgrade Ant Design automatically.
- Only change the Ant Design version when the team explicitly requests a dependency upgrade.
- Prefer existing Ant Design 5.21.6 components before adding another UI library.

## 3. Canonical source structure

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
│   │   ├── registration/
│   │   │   ├── plan.card.tsx
│   │   │   ├── plan.card.scss
│   │   │   ├── registration.tsx
│   │   │   └── registration.scss
│   │   └── guest.scss
│   ├── identity/
│   ├── instructor/
│   ├── layout/
│   │   ├── header.tsx
│   │   ├── header.scss
│   │   ├── footer.tsx
│   │   ├── footer.scss
│   │   ├── layout.admin.tsx
│   │   ├── layout.admin.scss
│   │   ├── layout.organizer.tsx
│   │   ├── layout.organizer.scss
│   │   ├── layout.instructor.tsx
│   │   ├── layout.instructor.scss
│   │   ├── layout.learner.tsx
│   │   └── layout.learner.scss
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

Do not create new top-level folders unless clearly needed.

## 4. Role structure

Use:

```text
Guest
Admin
Organizer
Instructor
Learner
```

Do not merge authenticated roles into a generic `user` folder.

## 5. Page placement

Route-level screens belong in:

```text
pages/<role>/
```

Examples:

```text
pages/guest/home.tsx
pages/guest/login.tsx
pages/guest/register.tsx
pages/admin/dashboard.tsx
pages/organizer/courses.tsx
pages/instructor/course-builder.tsx
pages/learner/my-courses.tsx
```

Do not place complete routed pages inside `components/`.

## 6. Component placement

Reusable role-specific UI belongs in:

```text
components/<role>/
```

Use `components/layout/` for:

- Header
- Footer
- Sidebar
- Topbar
- Shared layout shell
- Role layouts

Use `components/identity/` for:

- ProtectedRoute
- authentication/authorization UI helpers

Do not wrap every Ant Design primitive in a custom component.

## 7. File & folder naming convention

Follow the existing LearnUP naming style exactly.

### General rule

Use lowercase names.

For files with multiple semantic parts, use **dot-separated naming**.

Preferred:

```text
header.tsx
header.scss
footer.tsx
footer.scss

plan.card.tsx
plan.card.scss
registration.tsx

layout.admin.tsx
layout.admin.scss

identity.service.ts
course.types.ts
```

Do NOT use these alternatives when the file has multiple semantic parts:

```text
plan-card.tsx
plan_card.tsx
planCard.tsx
PlanCard.tsx
```

Pattern:

```text
<feature>.<purpose>.tsx
<feature>.<purpose>.scss
<domain>.service.ts
<domain>.types.ts
layout.<role>.tsx
layout.<role>.scss
```

Examples:

```text
plan.card.tsx
course.card.tsx
member.table.tsx
registration.tsx
progress.summary.tsx
course.detail.tsx
manage.user.tsx
```

Simple single-purpose files stay simple:

```text
home.tsx
login.tsx
register.tsx
header.tsx
footer.tsx
dashboard.tsx
```

### Folder naming

Folder names use lowercase.

Preferred:

```text
components/
pages/
services/
styles/
types/
utils/

admin/
guest/
organizer/
instructor/
learner/
identity/
layout/
context/
```

If a folder needs multiple words, use kebab-case:

```text
course-builder/
member-management/
peer-review/
```

Do NOT use dot naming for folder names.

Avoid:

```text
CourseBuilder/
courseBuilder/
course_builder/
course.builder/
```

### Component subfolder rule

Create a subfolder inside `components/<role>/` only when multiple reusable
components clearly belong to the same business/UI flow.

Preferred example:

```text
components/
└── guest/
    ├── registration/
    │   ├── plan.card.tsx
    │   ├── plan.card.scss
    │   ├── registration.tsx
    │   └── registration.scss
    └── guest.scss
```

Other valid examples when the group is actually needed:

```text
components/instructor/course-builder/
components/organizer/member-management/
components/learner/course-progress/
```

Rules:

- Do not create a subfolder for one simple component.
- Prefer grouping when there are roughly 2–3 or more closely related reusable files/components.
- Group by clear business/UI flow, not just to make the tree look organized.
- Do not over-nest folders.

### Page naming

Simple pages use one lowercase filename:

```text
home.tsx
login.tsx
register.tsx
dashboard.tsx
```

Pages with multiple semantic parts use dot-separated naming:

```text
course.builder.tsx
course.detail.tsx
manage.user.tsx
organization.detail.tsx
```

Avoid:

```text
CourseBuilder.tsx
course-builder.tsx
course_builder.tsx
courseBuilder.tsx
```

### Component naming

Simple components:

```text
header.tsx
footer.tsx
```

Components with multiple semantic parts:

```text
member.table.tsx
course.card.tsx
course.outline.tsx
status.tag.tsx
progress.summary.tsx
plan.card.tsx
registration.tsx
```

Component function names inside TypeScript/TSX still use PascalCase:

```tsx
const MemberTable = () => {
  // ...
};

export default MemberTable;
```

### Layout naming

Shared layout files follow:

```text
components/layout/
├── header.tsx
├── header.scss
├── footer.tsx
├── footer.scss
├── layout.admin.tsx
├── layout.admin.scss
├── layout.organizer.tsx
├── layout.organizer.scss
├── layout.instructor.tsx
├── layout.instructor.scss
├── layout.learner.tsx
└── layout.learner.scss
```

Only create the role layout SCSS file when that role actually needs role-specific layout styling.

### Service naming

Use:

```text
<domain>.service.ts
```

Examples:

```text
identity.service.ts
organization.service.ts
course.service.ts
learning.service.ts
assessment.service.ts
achievement.service.ts
notification.service.ts
```

### Type naming

Use:

```text
<domain>.types.ts
```

Examples:

```text
identity.types.ts
organization.types.ts
course.types.ts
learning.types.ts
assessment.types.ts
achievement.types.ts
```

Declaration files may use:

```text
global.d.ts
axios.d.ts
file.d.ts
vite-env.d.ts
```

Do not use `.d.ts` for ordinary business/domain types.

### SCSS file naming

Match the related TSX file naming.

Examples:

```text
plan.card.tsx
plan.card.scss

layout.admin.tsx
layout.admin.scss

home.tsx
home.scss
```

Do NOT use CSS Modules:

```text
plan.card.module.scss
home.module.scss
```

### Naming decision map

```text
Simple page
→ <feature>.tsx

Multi-part page
→ <feature>.<purpose>.tsx

Simple component
→ <component>.tsx

Multi-part component
→ <feature>.<purpose>.tsx

Related style
→ same base name + .scss

Service
→ <domain>.service.ts

Types
→ <domain>.types.ts

Role layout
→ layout.<role>.tsx
```

Always follow this repository convention before inventing a new naming pattern.

## 8. Routing

Main route definitions belong in:

```text
src/router.tsx
```

Do not define the main application router inside `main.tsx`.

For the current stage, use route strings directly inside `router.tsx`.

Example:

```tsx
{
  path: "/login",
  element: <LoginPage />,
}
```

Prefer nested routes where appropriate.

Use relative child paths.

Do not create:

```text
constants/
constants/routes.ts
```

yet.

Only introduce route constants later when duplication becomes genuinely hard to maintain or the team explicitly decides to centralize routes.

## 9. Import convention

Prefer one project-wide alias:

```text
@/*
```

Examples:

```ts
import HomePage from "@/pages/guest/home";
import axios from "@/services/axios.customize";
import type { ILogin } from "@/types/identity.types";
```

Avoid mixing aliases and deep relative imports unnecessarily.

## 10. Main application provider rule

Global application providers belong in:

```text
src/main.tsx
```

Current preferred structure:

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

- Do not create another `ConfigProvider` inside `layout.tsx`.
- Do not duplicate `AppProvider` inside role layouts.
- Do not wrap individual pages with global providers unless explicitly required.
- Keep `ConfigProvider` in `main.tsx`.
- At the current stage, use `ConfigProvider` mainly for global Ant Design configuration such as `locale`.
- Do NOT add LearnUP color/theme tokens to `ConfigProvider` by default.
- Keep LearnUP colors and visual design tokens centralized in `src/styles/global.scss`.
- Only add `theme` to `ConfigProvider` later when the team explicitly needs a true application-wide Ant Design override.

Do not do this in layouts:

```tsx
<ConfigProvider theme={{ ... }}>
  ...
</ConfigProvider>
```

when `main.tsx` already owns `ConfigProvider`.

## 11. Layout responsibility and layout styling

`src/layout.tsx` is the public/Guest composition layout and should remain simple.

Preferred shape:

```tsx
return (
  <>
    <Header />
    <Outlet />
    <Footer />
  </>
);
```

If a small layout-level state is genuinely required, keep it minimal.

Do not place in `layout.tsx` unless explicitly required:

- `ConfigProvider`
- global theme configuration
- duplicate application providers
- page-specific API logic
- page-specific form logic
- large business logic
- unrelated state
- Admin/Organizer/Instructor/Learner-specific layout behavior

### Global vs role-specific layout styles

Global structural foundations belong in:

```text
src/styles/global.scss
```

Examples:

- `html`
- `body`
- `#root`
- base `main` behavior
- reset
- fonts
- global design tokens
- accessibility foundations

Guest-specific layout styles belong in:

```text
components/guest/guest.scss
```

Examples:

```scss
.guest-layout {}
.guest-main {}
```

Authenticated role-specific layout styles should use their own files only when needed:

```text
components/layout/layout.admin.scss
components/layout/layout.organizer.scss
components/layout/layout.instructor.scss
components/layout/layout.learner.scss
```

Examples:

```scss
.admin-layout {}
.admin-main {}

.organizer-layout {}
.organizer-main {}
```

Rules:

- Do not use `.guest-layout` as the shared layout class for authenticated roles.
- Do not put role-specific layout styles in `global.scss`.
- Do not duplicate truly global structural rules across role SCSS files.
- Keep each role layout independent enough to evolve without affecting the others.
- If a style is genuinely global to all layouts, place it in `global.scss`.
- If a style belongs only to one role/layout, keep it in that role/layout SCSS file.

## 12. Services

Use:

```text
identity.service.ts
organization.service.ts
course.service.ts
learning.service.ts
assessment.service.ts
achievement.service.ts
notification.service.ts
```

Keep shared Axios configuration in:

```text
axios.customize.ts
```

Course assignment to Learners belongs to Learning, not Course.

Do not confuse Course assignment with Assignment exercise.

## 13. Types

Domain types use `.types.ts`.

Import explicitly:

```ts
import type { IUser } from "@/types/identity.types";
```

Use `global.d.ts` only for truly global generic declarations such as:

```text
IBackendRes<T>
IModelPaginate<T>
```

Use `.d.ts` only for actual declaration/module augmentation needs.

## 14. Utilities

Generic helpers belong under:

```text
utils/
```

Keep `utils/helper.ts` simple until a real need exists to split it.


## TSX and SCSS pairing rule

The team prefers component/page TSX and SCSS files to use the same base name.

Preferred:

```text
registration.tsx
registration.scss

plan.card.tsx
plan.card.scss

header.tsx
header.scss

login.tsx
login.scss

layout.admin.tsx
layout.admin.scss
```

Rules:

- When a TSX file has its own dedicated SCSS file, keep the same base filename.
- Do not rename a clear component such as `registration.tsx` to
  `registration.tsx` only to describe its internal responsibility if
  `registration.tsx` is already clear in its folder context.
- Use dot-separated naming only when the semantic purpose is genuinely useful
  and keep the SCSS pair identical.
- Prefer folder context + matching file pair over unnecessarily verbose filenames.

Examples:

```text
components/guest/registration/
├── registration.tsx
├── registration.scss
├── plan.card.tsx
└── plan.card.scss
```

Avoid inconsistent pairs such as:

```text
registration.tsx
registration.scss

plan.card.tsx
plan.scss
```

Decision priority:

```text
Clear folder context
→ matching TSX/SCSS base name
→ shortest clear filename
→ add dot-separated purpose only when it improves clarity
```

## 15. Styling convention

Use regular SCSS.

Do NOT use CSS Modules.

Preferred:

```text
header.tsx
header.scss

footer.tsx
footer.scss

home.tsx
home.scss

login.tsx
login.scss

register.tsx
register.scss

plan.card.tsx
plan.card.scss

layout.admin.tsx
layout.admin.scss
```

Import directly:

```ts
import "./header.scss";
```

## 16. SCSS class naming

Use simple prefixed kebab-case class names.

Do NOT use BEM double-underscore `__`.

Preferred:

```scss
.header {}
.header-title {}
.header-logo {}
.header-nav {}
.header-actions {}

.footer {}
.footer-title {}
.footer-links {}
.footer-bottom {}

.login {}
.login-title {}
.login-form {}
.login-submit {}

.register {}
.register-title {}
.register-form {}
.register-section {}
```

Do NOT use:

```scss
.header__title {}
.header__logo {}
.login__form {}
```

Rules:

- class names start with the owning component/page name;
- use lowercase kebab-case;
- use `<component>-<element>` or `<component>-<state>`;
- avoid generic global names such as `.title`, `.wrapper`, `.content`, `.item`, `.button`;
- keep names simple and easy for the team to control.

## 17. global.scss responsibility

`src/styles/global.scss` contains only true global foundations and design tokens.

Recommended scope:

- box-sizing/reset
- html/body/root
- Inter font stack
- default background/text colors
- link defaults
- form-control font inheritance
- base image behavior
- LearnUP CSS variables
- accessibility/focus defaults
- rare intentional global utilities

Do not put page-specific styles in `global.scss`.

Recommended base:

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

  font-family:
    Inter,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;

  color: var(--color-text-primary);
  background: var(--color-bg);
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  min-width: 320px;
  background: var(--color-bg);
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  background: var(--color-bg);
  color: var(--color-text-primary);
}

#root {
  min-height: 100vh;
}

button,
input,
textarea,
select {
  font: inherit;
}

img,
svg {
  max-width: 100%;
}

a {
  color: inherit;
  text-decoration: none;
}

:focus-visible {
  outline: 2px solid var(--color-info);
  outline-offset: 2px;
}
```

## 18. Legacy code

Do not copy bookstore concepts into LearnUP.

Migrate incrementally and avoid unrelated rewrites.

## 19. Dependency rule

Before adding any package:

1. check whether the current stack already solves the problem;
2. prefer Ant Design where appropriate;
3. prefer native React/TypeScript/browser APIs for simple needs.

## 20. Before finishing

Verify:

- naming follows lowercase + dot/kebab-case conventions;
- SCSS uses simple prefixed kebab-case names;
- no BEM `__`;
- no CSS Modules;
- code is in the correct role folder;
- providers remain in `main.tsx`;
- layouts remain focused on composition;
- imports resolve;
- TypeScript remains strict;
- no unnecessary `any`;
- no unrelated files changed;
- build/type check passes when possible;
- lint passes when relevant;
- no unnecessary architecture;
- no legacy bookstore concepts introduced.
