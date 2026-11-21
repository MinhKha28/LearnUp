import { validateInternalServiceKey } from '@learnup/ts-common';

export function validateRuntimeConfig(
  environment: Record<string, unknown>,
): Record<string, unknown> {
  validateInternalServiceKey(
    environment.INTERNAL_SERVICE_KEY,
    environment.NODE_ENV,
  );
  return environment;
}
