/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  /** Delivery milestone: "1" | "2" | "3"; anything else falls back to 1 (src/config/milestone.ts). */
  readonly VITE_MILESTONE?: string;
}
