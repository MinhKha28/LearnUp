import { describe, expect, it } from 'vitest';
import { HEADER_NAMES } from '../src/context/headers.js';

describe('Header Constants', () => {
  it('should define lowercase canonical header names', () => {
    expect(HEADER_NAMES.INTERNAL_KEY).toBe('x-internal-key');
    expect(HEADER_NAMES.USER_ID).toBe('x-user-id');
    expect(HEADER_NAMES.ORGANIZATION_ID).toBe('x-organization-id');
    expect(HEADER_NAMES.USER_ROLE).toBe('x-user-role');
    expect(HEADER_NAMES.CORRELATION_ID).toBe('x-correlation-id');
  });

  it('should not contain any tenantId header definition', () => {
    expect(HEADER_NAMES).not.toHaveProperty('TENANT_ID');
    expect(Object.values(HEADER_NAMES)).not.toContain('X-Tenant-ID');
  });
});
