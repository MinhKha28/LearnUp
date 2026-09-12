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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StructuredLogger = void 0;
const common_1 = require("@nestjs/common");
const tenant_context_1 = require("../context/tenant-context");
let StructuredLogger = class StructuredLogger {
    serviceName;
    constructor(serviceName = 'learnup-service') {
        this.serviceName = serviceName;
    }
    setServiceName(serviceName) {
        this.serviceName = serviceName;
    }
    log(message, context, extra) {
        this.writeEntry('INFO', message, context, undefined, extra);
    }
    error(message, stack, context, extra) {
        this.writeEntry('ERROR', message, context, stack, extra);
    }
    warn(message, context, extra) {
        this.writeEntry('WARN', message, context, undefined, extra);
    }
    debug(message, context, extra) {
        this.writeEntry('DEBUG', message, context, undefined, extra);
    }
    verbose(message, context, extra) {
        this.writeEntry('VERBOSE', message, context, undefined, extra);
    }
    writeEntry(level, message, context, stack, extra) {
        const store = tenant_context_1.TenantContext.getStore();
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            service: this.serviceName,
            correlationId: store?.correlationId || null,
            organizationId: store?.organizationId || null,
            userId: store?.userId || null,
            message,
            context: context || null,
            stack: stack || null,
            extra,
        };
        const serialized = JSON.stringify(entry);
        if (level === 'ERROR') {
            console.error(serialized);
        }
        else if (level === 'WARN') {
            console.warn(serialized);
        }
        else {
            console.log(serialized);
        }
    }
};
exports.StructuredLogger = StructuredLogger;
exports.StructuredLogger = StructuredLogger = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [Object])
], StructuredLogger);
//# sourceMappingURL=structured-logger.service.js.map