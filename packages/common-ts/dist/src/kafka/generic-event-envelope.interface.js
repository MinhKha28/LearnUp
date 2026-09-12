"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEventEnvelope = createEventEnvelope;
const uuid_1 = require("uuid");
function createEventEnvelope(params) {
    return {
        eventId: params.eventId ?? (0, uuid_1.v4)(),
        eventType: params.eventType,
        occurredAt: params.occurredAt ?? new Date().toISOString(),
        producer: params.producer,
        payload: params.payload,
        organizationId: params.organizationId,
        correlationId: params.correlationId,
    };
}
//# sourceMappingURL=generic-event-envelope.interface.js.map