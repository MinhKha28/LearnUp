import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContextStore {
  organizationId?: string;
  userId?: string;
  correlationId?: string;
}

const asyncLocalStorage = new AsyncLocalStorage<TenantContextStore>();

/**
 * AsyncLocalStorage-based holder for managing the active tenant context (organizationId) across asynchronous call stacks.
 */
export class TenantContext {
  /**
   * Retrieves the active organizationId from the current asynchronous context.
   */
  static getOrganizationId(): string | undefined {
    return asyncLocalStorage.getStore()?.organizationId;
  }

  /**
   * Retrieves the active organizationId or throws an Error if not set.
   */
  static requireOrganizationId(): string {
    const orgId = this.getOrganizationId();
    if (!orgId || orgId.trim().length === 0) {
      throw new Error('TenantContext organizationId is required but was not present in the current execution context.');
    }
    return orgId;
  }

  /**
   * Checks if an organizationId is currently active in context.
   */
  static isSet(): boolean {
    const orgId = this.getOrganizationId();
    return Boolean(orgId && orgId.trim().length > 0);
  }

  /**
   * Runs a function within an explicitly scoped tenant context.
   */
  static runWithTenant<T>(organizationId: string, callback: () => T): T {
    const currentStore = asyncLocalStorage.getStore() || {};
    const newStore: TenantContextStore = {
      ...currentStore,
      organizationId,
    };
    return asyncLocalStorage.run(newStore, callback);
  }

  /**
   * Runs an asynchronous function within an explicitly scoped tenant context.
   */
  static async runWithTenantAsync<T>(organizationId: string, callback: () => Promise<T>): Promise<T> {
    const currentStore = asyncLocalStorage.getStore() || {};
    const newStore: TenantContextStore = {
      ...currentStore,
      organizationId,
    };
    return asyncLocalStorage.run(newStore, callback);
  }

  /**
   * Gets the entire active store.
   */
  static getStore(): TenantContextStore | undefined {
    return asyncLocalStorage.getStore();
  }
}
