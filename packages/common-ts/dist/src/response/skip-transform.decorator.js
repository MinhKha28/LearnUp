"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkipResponseTransform = exports.SKIP_RESPONSE_TRANSFORM_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.SKIP_RESPONSE_TRANSFORM_KEY = 'learnup:skip_response_transform';
const SkipResponseTransform = () => (0, common_1.SetMetadata)(exports.SKIP_RESPONSE_TRANSFORM_KEY, true);
exports.SkipResponseTransform = SkipResponseTransform;
//# sourceMappingURL=skip-transform.decorator.js.map