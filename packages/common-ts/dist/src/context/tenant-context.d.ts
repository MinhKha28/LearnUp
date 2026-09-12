export interface TenantContextStore {
    organizationId?: string;
    userId?: string;
    correlationId?: string;
}
export declare class TenantContext {
    static getOrganizationId(): string | undefined;
    static requireOrganizationId(): string;
    static isSet(): boolean;
    static runWithTenant<T>(organizationId: string, callback: () => T): T;
    static runWithTenantAsync<T>(organizationId: string, callback: () => Promise<T>): Promise<T>;
    static getStore(): TenantContextStore | undefined;
}
