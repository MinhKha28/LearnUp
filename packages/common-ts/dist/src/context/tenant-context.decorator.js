"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentTenant = exports.TenantContext = exports.TenantContextDecorator = void 0;
const common_1 = require("@nestjs/common");
const tenant_context_interceptor_1 = require("./tenant-context.interceptor");
exports.TenantContextDecorator = (0, common_1.createParamDecorator)((data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    const context = request?.[tenant_context_interceptor_1.REQUEST_CONTEXT_KEY] || {};
    return data ? context[data] : context;
});
exports.TenantContext = exports.TenantContextDecorator;
exports.CurrentTenant = (0, common_1.createParamDecorator)((_data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    const context = request?.[tenant_context_interceptor_1.REQUEST_CONTEXT_KEY];
    return context?.organizationId;
});
//# sourceMappingURL=tenant-context.decorator.js.map