# LearnUP — ReactJS Frontend Foundation (`frontend/web`)

## 1. Overview
`frontend/web` is the ReactJS web client foundation for the **LearnUP B2B Multi-Tenant Learning Platform**. It provides a single-page application (SPA) foundation for authentication, session handling, protected and role-aware routing, and canonical tenant (`organizationId`) display.

---

## 2. Technology Stack
* **Framework / Core**: ReactJS 18+ (`react`, `react-dom`)
* **Language**: TypeScript 5.4+
* **Build Tool & Dev Server**: Vite 5.4+
* **Routing**: React Router 6.27+ (`react-router-dom`)
* **HTTP Client**: Axios 1.7+
* **Testing**: Vitest + `@testing-library/react` + `happy-dom`
* **Shared Contracts**: `@learnup/ts-common` (reusing `ApiResponse<T>`, `ApiError`, `PageResponse<T>`, `UserRole`)
* **Styling**: Vanilla CSS design system (no Tailwind, MUI, AntD, or Chakra scaffolding)

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
The platform defines exactly **4 roles**:
* `ADMIN` — Platform administrator (global management)
* `ORGANIZER` — Tenant administrator (learner cohorts, assignments)
* `INSTRUCTOR` — Course author and evaluator
* `LEARNER` — Enrolled student

*(Disallowed roles: `SUPER_ADMIN`, `ORG_ADMIN`, `TENANT_ADMIN`)*

---

## 5. Authentication & Token Management
* **Login Flow**:
  1. `POST /api/auth/login` with `{ username, password }` through Gateway.
  2. Receives `{ accessToken, refreshToken, tokenType, expiresIn }`.
  3. Tokens persisted in `localStorage` via `authStorage.ts`.
  4. `GET /api/users/me` loads current authenticated user profile (`AuthUser`).
  5. `AuthContext` updates and redirects user to `/dashboard`.
* **Token Persistence**: Isolated abstraction in `src/auth/authStorage.ts` for clean browser storage access.
* **Token Refresh**:
  1. `apiClient.ts` intercepts `401 Unauthorized` responses on protected endpoints.
  2. A concurrency lock (`isRefreshing`) and queue (`failedQueue`) prevent multiple or infinite refresh loops.
  3. Seamlessly calls `POST /api/auth/refresh` through the Gateway.
  4. Retries queued original requests with the new access token upon success.
  5. Clears tokens, dispatches `learnup:auth-expired`, and redirects to `/login` if refresh fails.

---

## 6. Route Protection & Guards
* **`ProtectedRoute`**: Blocks unauthenticated access and redirects visitors to `/login`.
* **`RoleRoute`**: Enforces required platform role(s) for specific routes; redirects unauthorized roles to `/unauthorized` (403).

---

## 7. Project Structure
```text
frontend/web/
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── .env.example
├── README.md
├── src/
│   ├── app/
│   │   ├── App.tsx             # Root application & AuthProvider wrapper
│   │   └── router.tsx          # React Router route definitions
│   ├── auth/
│   │   ├── AuthContext.tsx     # React context for auth state & operations
│   │   ├── authApi.ts          # Authentication Gateway API calls
│   │   ├── authStorage.ts      # Browser token storage abstraction
│   │   ├── ProtectedRoute.tsx  # Authentication route guard
│   │   └── RoleRoute.tsx       # Role-based route guard
│   ├── components/
│   │   └── layout/
│   │       └── MainLayout.tsx  # Role-aware header, navigation, & user profile
│   ├── config/
│   │   └── env.ts              # API base URL configuration
│   ├── pages/
│   │   ├── DashboardPage.tsx   # Authenticated dashboard & workspace placeholders
│   │   ├── LoginPage.tsx       # Login form with user-friendly error handling
│   │   ├── NotFoundPage.tsx    # 404 page
│   │   └── UnauthorizedPage.tsx# 403 access restricted page
│   ├── services/
│   │   └── apiClient.ts        # Centralized Axios client & refresh interceptor
│   ├── styles/
│   │   └── index.css           # Premium vanilla CSS styles
│   ├── types/
│   │   └── auth.ts             # Auth tokens, credentials, and user types
│   ├── main.tsx                # React DOM entry point
│   └── vite-env.d.ts           # Vite client type declarations
└── tests/
    ├── apiClient.test.ts       # Interceptor, JWT attachment, security headers
    ├── authApi.test.ts         # Gateway auth endpoints and response contracts
    ├── authStorage.test.ts     # LocalStorage persistence & cleanup
    ├── roleModel.test.ts       # Verification of the 4 platform roles
    ├── routingGuards.test.tsx  # ProtectedRoute & RoleRoute navigation guards
    └── tokenRefresh.test.ts    # 401 refresh, queueing, and loop prevention
```

---

## 8. Environment Variables
Configure environment in `.env` (or copy from `.env.example`):

| Variable | Description | Default |
|---|---|---|
| `VITE_API_BASE_URL` | Base URL of Spring Cloud API Gateway | `http://localhost:8080` |

---

## 9. Development Commands
```bash
# Install dependencies
npm install

# Start Vite development server (:5173)
npm run dev

# Run TypeScript typecheck
npm run typecheck

# Run unit and integration tests
npm test

# Build production bundle
npm run build

# Preview production build
npm run preview
```
