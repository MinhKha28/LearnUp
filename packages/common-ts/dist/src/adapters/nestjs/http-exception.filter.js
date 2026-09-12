"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const api_response_interface_1 = require("../../core/api/api-response.interface");
const headers_constant_1 = require("../../core/constants/headers.constant");
let HttpExceptionFilter = class HttpExceptionFilter {
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
        let status = common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        let code = 'INTERNAL_ERROR';
        let message = 'An unexpected internal error occurred.';
        let details = undefined;
        if (exception instanceof common_1.HttpException) {
            status = exception.getStatus();
            const res = exception.getResponse();
            if (typeof res === 'string') {
                message = res;
            }
            else if (typeof res === 'object' && res !== null) {
                const resObj = res;
                message = resObj.message || exception.message;
                if (Array.isArray(resObj.message)) {
                    message = 'Validation failed';
                    details = resObj.message.map((msg) => ({
                        field: 'request',
                        issue: msg,
                    }));
                }
            }
            switch (status) {
                case common_1.HttpStatus.BAD_REQUEST:
                    code = 'INVALID_INPUT';
                    break;
                case common_1.HttpStatus.UNAUTHORIZED:
                    code = 'UNAUTHORIZED';
                    break;
                case common_1.HttpStatus.FORBIDDEN:
                    code = 'FORBIDDEN';
                    break;
                case common_1.HttpStatus.NOT_FOUND:
                    code = 'RESOURCE_NOT_FOUND';
                    break;
                case common_1.HttpStatus.CONFLICT:
                    code = 'CONFLICT';
                    break;
                case common_1.HttpStatus.TOO_MANY_REQUESTS:
                    code = 'RATE_LIMITED';
                    break;
                default:
                    code = 'INTERNAL_ERROR';
                    break;
            }
        }
        else if (exception instanceof Error) {
            message = exception.message;
        }
        const correlationId = request?.headers?.[headers_constant_1.HeaderConstants.X_CORRELATION_ID];
        const apiError = {
            code,
            message,
            details,
            correlationId,
        };
        response.status(status).json((0, api_response_interface_1.createErrorResponse)(apiError));
    }
};
exports.HttpExceptionFilter = HttpExceptionFilter;
exports.HttpExceptionFilter = HttpExceptionFilter = __decorate([
    (0, common_1.Catch)()
], HttpExceptionFilter);
//# sourceMappingURL=http-exception.filter.js.map