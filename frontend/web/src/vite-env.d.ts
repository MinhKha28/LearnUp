/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  /** Delivery milestone: "1" | "2" | "3"; anything else falls back to 1 (src/config/milestone.ts). */
  readonly VITE_MILESTONE?: string;
  /** "true" starts the MSW mocks in development (src/mocks). Ignored in production builds. */
  readonly VITE_USE_MOCKS?: string;
  /** Comma-separated optional mock groups for endpoints the backend already has, e.g. "auth". */
  readonly VITE_MOCKS_INCLUDE?: string;
}
