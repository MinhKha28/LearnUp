"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALLOWED_ROLES = exports.PlatformRole = void 0;
exports.isValidRole = isValidRole;
exports.PlatformRole = {
    ADMIN: 'ADMIN',
    ORGANIZER: 'ORGANIZER',
    INSTRUCTOR: 'INSTRUCTOR',
    LEARNER: 'LEARNER',
};
exports.ALLOWED_ROLES = [
    exports.PlatformRole.ADMIN,
    exports.PlatformRole.ORGANIZER,
    exports.PlatformRole.INSTRUCTOR,
    exports.PlatformRole.LEARNER,
];
function isValidRole(role) {
    if (!role) {
        return false;
    }
    return exports.ALLOWED_ROLES.includes(role.toUpperCase());
}
//# sourceMappingURL=roles.constant.js.map