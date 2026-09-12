import { TenantContext } from '../../src/context/tenant-context';

describe('TenantContext', () => {
  it('should run callback within scoped tenant context and restore state', () => {
    expect(TenantContext.isSet()).toBe(false);
    expect(TenantContext.getOrganizationId()).toBeUndefined();

    const result = TenantContext.runWithTenant('org_test_123', () => {
      expect(TenantContext.isSet()).toBe(true);
      expect(TenantContext.getOrganizationId()).toBe('org_test_123');
      expect(TenantContext.requireOrganizationId()).toBe('org_test_123');
      return 'completed';
    });

    expect(result).toBe('completed');
    expect(TenantContext.isSet()).toBe(false);
  });

  it('should support asynchronous scoped execution with runWithTenantAsync', async () => {
    const asyncResult = await TenantContext.runWithTenantAsync('org_async_1', async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(TenantContext.getOrganizationId()).toBe('org_async_1');
      return 42;
    });

    expect(asyncResult).toBe(42);
    expect(TenantContext.isSet()).toBe(false);
  });

  it('should throw Error on requireOrganizationId when context is empty', () => {
    expect(() => TenantContext.requireOrganizationId()).toThrow();
  });
});
