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
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggingInterceptor = void 0;
const common_1 = require("@nestjs/common");
const operators_1 = require("rxjs/operators");
const structured_logger_service_1 = require("./structured-logger.service");
let LoggingInterceptor = class LoggingInterceptor {
    logger;
    constructor(serviceName = 'learnup-service') {
        this.logger = new structured_logger_service_1.StructuredLogger(serviceName);
    }
    intercept(context, next) {
        const req = context.switchToHttp().getRequest();
        const res = context.switchToHttp().getResponse();
        if (!req) {
            return next.handle();
        }
        const method = req.method;
        const url = req.originalUrl || req.url;
        const startTime = Date.now();
        return next.handle().pipe((0, operators_1.tap)({
            next: () => {
                const duration = Date.now() - startTime;
                const statusCode = res?.statusCode || 200;
                this.logger.log(`HTTP ${method} ${url} completed with status ${statusCode} in ${duration}ms`, 'HTTP', { method, url, statusCode, durationMs: duration });
            },
            error: (error) => {
                const duration = Date.now() - startTime;
                this.logger.error(`HTTP ${method} ${url} failed after ${duration}ms: ${error.message}`, error.stack, 'HTTP', { method, url, durationMs: duration });
            },
        }));
    }
};
exports.LoggingInterceptor = LoggingInterceptor;
exports.LoggingInterceptor = LoggingInterceptor = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [Object])
], LoggingInterceptor);
//# sourceMappingURL=logging.interceptor.js.map