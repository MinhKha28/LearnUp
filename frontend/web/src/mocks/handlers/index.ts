import type { RequestHandler } from 'msw';
import { authHandlers } from './auth';

/**
 * Handlers that are always on: endpoints the backend does NOT have yet. One file per feature
 * (e.g. ./subscriptionPlans.ts), each entry documented in docs/api-contracts.md as
 * "Giả định — chờ backend xác nhận". Remove a feature's handlers once the backend ships it.
 */
export const defaultHandlers: RequestHandler[] = [];

/**
 * Handlers for endpoints the backend already has. Off unless named in VITE_MOCKS_INCLUDE
 * (comma-separated, e.g. "auth"), for working without the backend.
 */
export const optionalHandlers = {
  auth: authHandlers,
} satisfies Record<string, RequestHandler[]>;

export type OptionalMockGroup = keyof typeof optionalHandlers;

const isOptionalGroup = (name: string): name is OptionalMockGroup => name in optionalHandlers;

/** "auth, foo" → the optional groups it names; unknown names are ignored. */
export const parseMockGroups = (value: string | undefined): OptionalMockGroup[] =>
  (value ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(isOptionalGroup);

export const getHandlers = (include: readonly OptionalMockGroup[] = []): RequestHandler[] => [
  ...defaultHandlers,
  ...include.flatMap((group) => optionalHandlers[group]),
];
