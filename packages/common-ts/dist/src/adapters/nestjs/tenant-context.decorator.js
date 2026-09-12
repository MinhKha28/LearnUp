"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantContext = void 0;
const common_1 = require("@nestjs/common");
const tenant_context_interceptor_1 = require("./tenant-context.interceptor");
exports.TenantContext = (0, common_1.createParamDecorator)((data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    const context = request?.[tenant_context_interceptor_1.REQUEST_CONTEXT_KEY] || {};
    return data ? context[data] : context;
});
//# sourceMappingURL=tenant-context.decorator.js.map