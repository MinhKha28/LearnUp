"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantContext = void 0;
const async_hooks_1 = require("async_hooks");
const asyncLocalStorage = new async_hooks_1.AsyncLocalStorage();
class TenantContext {
    static getOrganizationId() {
        return asyncLocalStorage.getStore()?.organizationId;
    }
    static requireOrganizationId() {
        const orgId = this.getOrganizationId();
        if (!orgId || orgId.trim().length === 0) {
            throw new Error('TenantContext organizationId is required but was not present in the current execution context.');
        }
        return orgId;
    }
    static isSet() {
        const orgId = this.getOrganizationId();
        return Boolean(orgId && orgId.trim().length > 0);
    }
    static runWithTenant(organizationId, callback) {
        const currentStore = asyncLocalStorage.getStore() || {};
        const newStore = {
            ...currentStore,
            organizationId,
        };
        return asyncLocalStorage.run(newStore, callback);
    }
    static async runWithTenantAsync(organizationId, callback) {
        const currentStore = asyncLocalStorage.getStore() || {};
        const newStore = {
            ...currentStore,
            organizationId,
        };
        return asyncLocalStorage.run(newStore, callback);
    }
    static getStore() {
        return asyncLocalStorage.getStore();
    }
}
exports.TenantContext = TenantContext;
//# sourceMappingURL=tenant-context.js.map