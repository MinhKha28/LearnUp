# LearnUP — ReactJS Web Client (`frontend/web`)

## 1. Overview

`frontend/web` is the ReactJS single-page application of the **LearnUP B2B Multi-Tenant Learning Platform**. The current foundation provides authentication and session handling, protected and role-aware routing, public / auth / role-based app layouts, a design-token system, base UI components and bilingual UI (Vietnamese by default, English). Role pages are routed but still render a placeholder until each feature is built.

> **Working in this folder?** Read [`AGENTS.md`](AGENTS.md) first — it is the single source of rules for people and AI agents (conventions, where to put code, i18n, testing, git, and the screen-from-design workflow). Details live in [`docs/`](docs/):
>
> - [`docs/design-tokens.md`](docs/design-tokens.md) — colors, typography, spacing, layout, design decisions.
> - [`docs/glossary.md`](docs/glossary.md) — Vietnamese / English terminology.
> - [`docs/api-contracts.md`](docs/api-contracts.md) — API contracts, existing and assumed (mocked with MSW).
> - [`docs/use-cases/`](docs/use-cases/) — use case specifications per design batch.

---

## 2. Technology Stack

- **Framework / Core**: React 18 (`react`, `react-dom`)
- **Language**: TypeScript 5.4+ (strict)
- **Build Tool & Dev Server**: Vite 5.4+
- **Routing**: React Router 6.27+ (`react-router-dom`, v7 future flags enabled)
- **HTTP Client**: Axios 1.7+
- **i18n**: i18next + react-i18next (`vi` default, `en`)
- **Styling**: CSS Modules on top of design tokens (`src/styles/tokens.css`); no Tailwind, MUI, AntD or Chakra
- **UI primitives**: Radix UI (Dialog, DropdownMenu, Tooltip), `lucide-react` icons, `@fontsource/inter`
- **Testing**: Vitest + `@testing-library/react` + `happy-dom`
- **Quality**: ESLint 9 (typescript-eslint, react-hooks, i18next literal-string rule), Stylelint (design tokens enforced in `*.module.css`), Prettier
- **Shared Contracts**: `@learnup/ts-common` (`ApiResponse<T>`, `ApiError`, `PageResponse<T>`, `UserRole`)

---

## 3. Architecture & Gateway Dependency

The frontend communicates **exclusively** through the Spring Cloud API Gateway:

```text
React Frontend (:5173)
      │
      ▼
Spring Cloud API Gateway (:8080)
      │
      ▼
Downstream Microservices (Identity Service, Organization Service, Course Service, etc.)
```

### Constraints & Security Boundaries:

1. **Single Entry Point**: The frontend never calls Eureka (:8761), business microservices, Kafka, or PostgreSQL directly.
2. **Identity Sanitization & Injection**: The frontend **NEVER** constructs or sends trusted headers (`X-User-ID`, `X-Organization-ID`, `X-User-Role`). These headers are stripped and injected by the API Gateway upon JWT validation.
3. **Canonical Tenant**: The platform uses `organizationId` exclusively (no `tenantId` / `orgId`).
4. **Authorization Boundary**:
   > **Important**: Frontend role checks are for UI/navigation visibility and route experience only. Backend services remain strictly responsible for business authorization and multi-tenant data isolation.

---

## 4. Platform Roles

The platform defines exactly **4 roles** (display names follow [`docs/glossary.md`](docs/glossary.md)):

- `ADMIN` — Admin / Quản trị viên (platform-wide management)
- `ORGANIZER` — Organizer / Quản lý tổ chức (manages one organization: instructors, learners, course assignment)
- `INSTRUCTOR` — Instructor / Giảng viên (course author and evaluator)
- `LEARNER` — Learner / Học viên

_(Disallowed roles: `SUPER_ADMIN`, `ORG_ADMIN`, `TENANT_ADMIN`)_

---

## 5. Authentication & Token Management

- **Login Flow**:
  1. `POST /api/auth/login` with `{ username, password }` through the Gateway.
  2. Receives `{ accessToken, refreshToken, tokenType, expiresIn }`.
  3. Tokens are persisted in `localStorage` via `src/auth/authStorage.ts`.
  4. `GET /api/users/me` loads the current user profile (`AuthUser`).
  5. `AuthProvider` updates the auth state (read with `useAuth()`), and `LoginPage` (`src/features/auth/pages/`) redirects to the page the user came from, or to the role home (`getPostLoginPath` / `getHomePath` in `src/app/navigation.ts`).
- **Token Refresh** (`src/services/apiClient.ts`):
  1. Intercepts `401 Unauthorized` responses on protected endpoints.
  2. A concurrency lock (`isRefreshing`) and queue (`failedQueue`) prevent multiple or infinite refresh loops.
  3. Calls `POST /api/auth/refresh` through the Gateway and retries the queued requests with the new access token.
  4. If refresh fails, clears tokens, dispatches `learnup:auth-expired`, and redirects to `/login`.
- **Response helpers**: `unwrap(response)` returns the `ApiResponse` payload or throws; `getApiErrorMessage(err)` returns a translated, user-facing message.

---

## 6. Routing, Navigation & Milestones

- **`ProtectedRoute`** blocks unauthenticated access and redirects to `/login`.
- **`RoleRoute`** wraps each role area (`/admin`, `/organizer`, `/instructor`, `/learner`) and sends other roles to `/unauthorized` (403).
- **`src/app/navigation.ts`** declares each role's sidebar menu once (label key, path, icon, use case, `availableFrom`). Routes in `src/app/routes.tsx` are generated from it; the first item is the role's home page.
- **Milestones**: `VITE_MILESTONE` (1–3) selects which menu items and routes exist. Items whose `availableFrom` is above it are hidden and their paths answer 404.
- **Layouts**: `AuthLayout` (sign-in), `PublicLayout` (public pages such as `/pricing`), `AppLayout` (header, sidebar/drawer, user menu, language switcher) for signed-in pages.
- **Dev only**: `/dev/ui` shows every base UI component; it is excluded from production builds.

---

## 7. Project Structure

```text
frontend/web/
├── AGENTS.md / CLAUDE.md   # Rules for people and AI agents (CLAUDE.md imports AGENTS.md)
├── docs/                   # design-tokens.md, glossary.md
├── src/
│   ├── app/                # App, router, routes, navigation (menus + milestones), home redirect
│   ├── auth/               # AuthProvider, useAuth, ProtectedRoute, RoleRoute, authApi, authStorage
│   ├── components/
│   │   ├── ui/             # Base components (Button, TextField, Select, Modal, Alert, EmptyState…)
│   │   └── layout/         # AppLayout, AuthLayout, PublicLayout, Sidebar, UserMenu, LanguageSwitcher…
│   ├── config/             # env.ts, milestone.ts, routes.ts
│   ├── dev/                # /dev/ui component catalog (development only)
│   ├── features/<name>/    # feature screens: api/, components/, pages/, <form>Schema.ts (auth: LoginPage)
│   ├── i18n/               # i18next setup and resources
│   ├── lib/                # cx, date/number formatting
│   ├── locales/{vi,en}/    # common, auth, errors, nav
│   ├── pages/              # NotFoundPage, UnauthorizedPage, PlaceholderPage
│   ├── services/           # apiClient (Axios, refresh interceptor, unwrap, getApiErrorMessage)
│   ├── styles/             # tokens.css, base.css, index.css
│   ├── types/              # auth types
│   └── main.tsx
└── tests/                  # Vitest suites (ui/, layout/, auth, routing, i18n, api client…)
```

New features go in `src/features/<name>/` — see [`AGENTS.md`](AGENTS.md) §2.

---

## 8. Environment Variables

Copy `.env.example` to `.env`:

| Variable             | Description                                          | Default                 |
| -------------------- | ---------------------------------------------------- | ----------------------- |
| `VITE_API_BASE_URL`  | Base URL of the Spring Cloud API Gateway             | `http://localhost:8080` |
| `VITE_MILESTONE`     | Delivery milestone (`1`, `2`, `3`); invalid → `1`    | `1`                     |
| `VITE_USE_MOCKS`     | `true` starts MSW mocks in development (`src/mocks`) | `false`                 |
| `VITE_MOCKS_INCLUDE` | Also mock endpoints the backend has, e.g. `auth`     | _(empty)_               |

To work on a later milestone locally, set `VITE_MILESTONE` in `.env.local` (not committed).

---

## 9. Development Commands

First-time setup — `@learnup/ts-common` is installed from `libraries/ts-common` and must be built first:

```bash
cd libraries/ts-common && npm install && npm run build
cd ../../frontend/web && npm install
```

```bash
npm run dev           # Vite dev server (:5173)
npm run lint          # ESLint + Stylelint
npm test              # Vitest
npm run typecheck     # tsc --noEmit
npm run build         # Production bundle
npm run format        # Prettier (format:check to verify only)
npm run preview       # Preview the production build
```
