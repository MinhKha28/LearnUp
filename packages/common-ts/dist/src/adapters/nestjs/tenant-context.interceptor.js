"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantContextInterceptor = exports.REQUEST_CONTEXT_KEY = void 0;
const common_1 = require("@nestjs/common");
const headers_constant_1 = require("../../core/constants/headers.constant");
const roles_constant_1 = require("../../core/constants/roles.constant");
exports.REQUEST_CONTEXT_KEY = 'LEARNUP_REQUEST_CONTEXT';
let TenantContextInterceptor = class TenantContextInterceptor {
    intercept(context, next) {
        const req = context.switchToHttp().getRequest();
        if (req) {
            const userId = req.headers[headers_constant_1.HeaderConstants.X_USER_ID];
            const organizationId = req.headers[headers_constant_1.HeaderConstants.X_ORGANIZATION_ID];
            const correlationId = req.headers[headers_constant_1.HeaderConstants.X_CORRELATION_ID];
            const roleHeader = req.headers['x-user-role'];
            const role = roleHeader && (0, roles_constant_1.isValidRole)(roleHeader)
                ? roleHeader.toUpperCase()
                : undefined;
            const requestContext = {
                userId,
                organizationId,
                role,
                correlationId,
            };
            req[exports.REQUEST_CONTEXT_KEY] = requestContext;
        }
        return next.handle();
    }
};
exports.TenantContextInterceptor = TenantContextInterceptor;
exports.TenantContextInterceptor = TenantContextInterceptor = __decorate([
    (0, common_1.Injectable)()
], TenantContextInterceptor);
//# sourceMappingURL=tenant-context.interceptor.js.map