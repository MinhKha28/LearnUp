import { describe, expect, it } from 'vitest';
import { HEADER_NAMES } from '../src/context/headers.js';

describe('Header Constants', () => {
  it('should define canonical header names matching P0 and P1 specifications', () => {
    expect(HEADER_NAMES.USER_ID).toBe('X-User-ID');
    expect(HEADER_NAMES.ORGANIZATION_ID).toBe('X-Organization-ID');
    expect(HEADER_NAMES.USER_ROLE).toBe('X-User-Role');
    expect(HEADER_NAMES.CORRELATION_ID).toBe('X-Correlation-ID');
  });

  it('should not contain any tenantId header definition', () => {
    expect(HEADER_NAMES).not.toHaveProperty('TENANT_ID');
    expect(Object.values(HEADER_NAMES)).not.toContain('X-Tenant-ID');
  });
});
