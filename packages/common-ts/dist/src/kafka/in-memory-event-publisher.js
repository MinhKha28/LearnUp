"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryEventPublisher = void 0;
const generic_event_envelope_interface_1 = require("./generic-event-envelope.interface");
class InMemoryEventPublisher {
    publishedEvents = [];
    producerServiceName;
    constructor(producerServiceName = 'test-service') {
        this.producerServiceName = producerServiceName;
    }
    async publish(topic, eventType, organizationId, correlationId, payload) {
        const envelope = (0, generic_event_envelope_interface_1.createEventEnvelope)({
            eventType,
            producer: this.producerServiceName,
            payload,
            organizationId,
            correlationId,
        });
        return this.publishEnvelope(topic, envelope);
    }
    async publishEnvelope(topic, envelope) {
        this.publishedEvents.push({ topic, envelope });
    }
    getPublishedEvents() {
        return [...this.publishedEvents];
    }
    clear() {
        this.publishedEvents.length = 0;
    }
}
exports.InMemoryEventPublisher = InMemoryEventPublisher;
//# sourceMappingURL=in-memory-event-publisher.js.map