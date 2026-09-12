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
const rxjs_1 = require("rxjs");
const header_constants_1 = require("./header.constants");
const roles_constant_1 = require("../auth/roles.constant");
const current_user_1 = require("../auth/current-user");
const current_user_decorator_1 = require("../auth/current-user.decorator");
const tenant_context_1 = require("./tenant-context");
exports.REQUEST_CONTEXT_KEY = 'LEARNUP_REQUEST_CONTEXT';
let TenantContextInterceptor = class TenantContextInterceptor {
    intercept(context, next) {
        const req = context.switchToHttp().getRequest();
        if (req) {
            const userId = req.headers[header_constants_1.HeaderConstants.X_USER_ID];
            const organizationId = req.headers[header_constants_1.HeaderConstants.X_ORGANIZATION_ID];
            const correlationId = req.headers[header_constants_1.HeaderConstants.X_CORRELATION_ID];
            const roleHeader = req.headers[header_constants_1.HeaderConstants.X_USER_ROLE];
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
            if (userId && organizationId && role) {
                const currentUser = new current_user_1.CurrentUser({
                    userId,
                    organizationId,
                    role,
                    correlationId,
                });
                req[current_user_decorator_1.CURRENT_USER_KEY] = currentUser;
            }
            if (organizationId) {
                return new rxjs_1.Observable((observer) => {
                    tenant_context_1.TenantContext.runWithTenant(organizationId, () => {
                        next.handle().subscribe(observer);
                    });
                });
            }
        }
        return next.handle();
    }
};
exports.TenantContextInterceptor = TenantContextInterceptor;
exports.TenantContextInterceptor = TenantContextInterceptor = __decorate([
    (0, common_1.Injectable)()
], TenantContextInterceptor);
//# sourceMappingURL=tenant-context.interceptor.js.map