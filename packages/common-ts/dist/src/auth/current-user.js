"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentUser = void 0;
const roles_constant_1 = require("./roles.constant");
class CurrentUser {
    userId;
    organizationId;
    role;
    correlationId;
    constructor(props) {
        this.userId = props.userId;
        this.organizationId = props.organizationId;
        this.role = props.role;
        this.correlationId = props.correlationId;
    }
    hasRole(targetRole) {
        if (!this.role || !targetRole) {
            return false;
        }
        return this.role.toUpperCase() === targetRole.trim().toUpperCase();
    }
    isAdmin() {
        return this.hasRole(roles_constant_1.PlatformRole.ADMIN);
    }
    isOrganizer() {
        return this.hasRole(roles_constant_1.PlatformRole.ORGANIZER);
    }
    isInstructor() {
        return this.hasRole(roles_constant_1.PlatformRole.INSTRUCTOR);
    }
    isLearner() {
        return this.hasRole(roles_constant_1.PlatformRole.LEARNER);
    }
    belongsToOrganization(targetOrgId) {
        if (!this.organizationId || !targetOrgId) {
            return false;
        }
        return this.organizationId === targetOrgId;
    }
}
exports.CurrentUser = CurrentUser;
//# sourceMappingURL=current-user.js.map