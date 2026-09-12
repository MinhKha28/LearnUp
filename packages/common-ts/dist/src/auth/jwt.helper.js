"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JwtHelper = void 0;
const current_user_1 = require("./current-user");
const roles_constant_1 = require("./roles.constant");
class JwtHelper {
    static decodePayload(token) {
        if (!token || typeof token !== 'string') {
            return null;
        }
        const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
        const parts = cleanToken.split('.');
        if (parts.length !== 3) {
            return null;
        }
        try {
            const base64Url = parts[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
            return JSON.parse(jsonPayload);
        }
        catch {
            return null;
        }
    }
    static isValidPayload(payload) {
        if (!payload || typeof payload !== 'object') {
            return false;
        }
        const p = payload;
        const hasSub = typeof p.sub === 'string' && p.sub.trim().length > 0;
        const hasOrgId = typeof p.organizationId === 'string' && p.organizationId.trim().length > 0;
        const hasRole = typeof p.role === 'string' && (0, roles_constant_1.isValidRole)(p.role);
        const hasExp = typeof p.exp === 'number';
        return hasSub && hasOrgId && hasRole && hasExp;
    }
    static toCurrentUser(payload, correlationId) {
        return new current_user_1.CurrentUser({
            userId: payload.sub,
            organizationId: payload.organizationId,
            role: payload.role,
            correlationId,
        });
    }
}
exports.JwtHelper = JwtHelper;
//# sourceMappingURL=jwt.helper.js.map