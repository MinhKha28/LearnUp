// Opt in to the React Router v7 behaviours the app router uses, so tests match production
// and stay free of future-flag warnings.
export const ROUTER_FUTURE_FLAGS = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
} as const;
