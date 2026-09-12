import { v4 as uuidv4 } from 'uuid';
import { HeaderConstants } from '../constants/headers.constant';

/**
 * Framework-neutral correlation ID utilities.
 */
export function generateCorrelationId(): string {
  return uuidv4();
}

export function extractOrGenerateCorrelationId(headers: Record<string, string | string[] | undefined>): string {
  const headerVal = headers[HeaderConstants.X_CORRELATION_ID] || headers['x-correlation-id'];
  if (headerVal) {
    return Array.isArray(headerVal) ? headerVal[0] : headerVal;
  }
  return generateCorrelationId();
}
