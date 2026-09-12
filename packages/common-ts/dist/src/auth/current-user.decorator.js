"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentUserDecorator = exports.CURRENT_USER_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.CURRENT_USER_KEY = 'LEARNUP_CURRENT_USER';
exports.CurrentUserDecorator = (0, common_1.createParamDecorator)((data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request?.[exports.CURRENT_USER_KEY];
    if (!user) {
        return undefined;
    }
    return data ? user[data] : user;
});
//# sourceMappingURL=current-user.decorator.js.map