# Frontend Web Application (`frontend/web`)

## Technology Stack
* ReactJS 18+
* TypeScript
* Vite
* React Router 6+
* Axios

## Architectural Role
* User interface for authentication, organization navigation, course browsing, learning, and assessments.
* Interacts **only** with the API Gateway (`http://localhost:8080/api/...`).
* Stores JWT securely in memory / HTTP headers and manages authentication context.
* Provides route guards based on user role (`ADMIN`, `ORGANIZER`, `INSTRUCTOR`, `LEARNER`).

## Directory Structure (Implementation Plan in P6)
```text
frontend/web/src/
├── app/                  # App initialization, providers, theme
├── components/           # Reusable UI components (buttons, tables, modals)
├── layouts/              # MainLayout, AuthLayout, DashboardLayout
├── pages/                # Route pages (Login, Dashboard, Learners, Courses)
├── routes/               # AppRoutes and ProtectedRoute guards
├── services/             # Axios API clients
├── hooks/                # Custom React hooks (useAuth, useTenant)
├── types/                # TypeScript interfaces
└── utils/                # Date, string, and token helpers
```
