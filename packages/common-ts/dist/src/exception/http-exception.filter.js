"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var HttpExceptionFilter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const api_response_interface_1 = require("../response/api-response.interface");
const error_codes_constant_1 = require("./error-codes.constant");
const header_constants_1 = require("../context/header.constants");
const base_exception_1 = require("./base.exception");
let HttpExceptionFilter = HttpExceptionFilter_1 = class HttpExceptionFilter {
    logger = new common_1.Logger(HttpExceptionFilter_1.name);
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
        let status = common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        let code = error_codes_constant_1.ErrorCode.INTERNAL_ERROR;
        let message = 'An unexpected internal platform error occurred.';
        let details = null;
        if (exception instanceof base_exception_1.BaseException) {
            status = exception.getStatus();
            code = exception.errorCode;
            message = exception.message;
            details = exception.details || null;
        }
        else if (exception instanceof common_1.HttpException) {
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
                if (typeof resObj.code === 'string') {
                    code = resObj.code;
                }
            }
            if (code === error_codes_constant_1.ErrorCode.INTERNAL_ERROR) {
                code = this.mapStatusToErrorCode(status);
            }
        }
        else if (exception instanceof Error) {
            message = exception.message;
            this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
        }
        const correlationId = request?.headers?.[header_constants_1.HeaderConstants.X_CORRELATION_ID] ||
            request?.headers?.['x-correlation-id'] ||
            null;
        const apiError = {
            code,
            message,
            details,
            correlationId,
        };
        response.status(status).json((0, api_response_interface_1.createErrorResponse)(apiError));
    }
    mapStatusToErrorCode(status) {
        switch (status) {
            case common_1.HttpStatus.BAD_REQUEST:
                return error_codes_constant_1.ErrorCode.INVALID_INPUT;
            case common_1.HttpStatus.UNAUTHORIZED:
                return error_codes_constant_1.ErrorCode.UNAUTHORIZED;
            case common_1.HttpStatus.FORBIDDEN:
                return error_codes_constant_1.ErrorCode.FORBIDDEN;
            case common_1.HttpStatus.NOT_FOUND:
                return error_codes_constant_1.ErrorCode.RESOURCE_NOT_FOUND;
            case common_1.HttpStatus.CONFLICT:
                return error_codes_constant_1.ErrorCode.CONFLICT;
            case common_1.HttpStatus.TOO_MANY_REQUESTS:
                return error_codes_constant_1.ErrorCode.RATE_LIMITED;
            case common_1.HttpStatus.SERVICE_UNAVAILABLE:
                return error_codes_constant_1.ErrorCode.SERVICE_UNAVAILABLE;
            default:
                return error_codes_constant_1.ErrorCode.INTERNAL_ERROR;
        }
    }
};
exports.HttpExceptionFilter = HttpExceptionFilter;
exports.HttpExceptionFilter = HttpExceptionFilter = HttpExceptionFilter_1 = __decorate([
    (0, common_1.Catch)()
], HttpExceptionFilter);
//# sourceMappingURL=http-exception.filter.js.map