"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseTransformInterceptor = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const operators_1 = require("rxjs/operators");
const api_response_interface_1 = require("./api-response.interface");
const skip_transform_decorator_1 = require("./skip-transform.decorator");
let ResponseTransformInterceptor = class ResponseTransformInterceptor {
    reflector;
    constructor(reflector = new core_1.Reflector()) {
        this.reflector = reflector;
    }
    intercept(context, next) {
        const isSkipped = this.reflector.getAllAndOverride(skip_transform_decorator_1.SKIP_RESPONSE_TRANSFORM_KEY, [context.getHandler(), context.getClass()]);
        if (isSkipped) {
            return next.handle();
        }
        return next.handle().pipe((0, operators_1.map)((result) => {
            if (result &&
                typeof result === 'object' &&
                'success' in result &&
                'timestamp' in result) {
                return result;
            }
            if (result &&
                typeof result === 'object' &&
                'items' in result &&
                'meta' in result) {
                const pageResult = result;
                return (0, api_response_interface_1.createSuccessResponse)(pageResult.items, pageResult.meta);
            }
            return (0, api_response_interface_1.createSuccessResponse)(result);
        }));
    }
};
exports.ResponseTransformInterceptor = ResponseTransformInterceptor;
exports.ResponseTransformInterceptor = ResponseTransformInterceptor = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeof (_a = typeof core_1.Reflector !== "undefined" && core_1.Reflector) === "function" ? _a : Object])
], ResponseTransformInterceptor);
//# sourceMappingURL=response-transform.interceptor.js.map