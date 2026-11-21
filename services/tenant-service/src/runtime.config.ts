import { validateInternalServiceKey } from '@learnup/ts-common';
import { validateEnvironment as validateOtpEnvironment } from './common/utils/otp.util';

export function validateRuntimeConfig(
  environment: Record<string, unknown>,
): Record<string, unknown> {
  validateOtpEnvironment(environment);
  validateInternalServiceKey(
    environment.INTERNAL_SERVICE_KEY,
    environment.NODE_ENV,
  );
  return environment;
}
