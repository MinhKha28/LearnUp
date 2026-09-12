import { v4 as uuidv4 } from 'uuid';
import { HeaderConstants } from '../context/header.constants';

/**
 * Generates a standard UUID correlation ID.
 */
export function generateCorrelationId(): string {
  return uuidv4();
}

/**
 * Extracts correlation ID from incoming headers or generates a new one.
 */
export function extractOrGenerateCorrelationId(
  headers?: Record<string, string | string[] | undefined>,
): string {
  if (!headers) {
    return generateCorrelationId();
  }
  const headerVal =
    headers[HeaderConstants.X_CORRELATION_ID] ||
    headers[HeaderConstants.X_CORRELATION_ID.toLowerCase()] ||
    headers['x-correlation-id'];

  if (headerVal) {
    return Array.isArray(headerVal) ? headerVal[0] : headerVal;
  }
  return generateCorrelationId();
}
