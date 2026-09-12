"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KafkaEventPublisher = void 0;
const generic_event_envelope_interface_1 = require("./generic-event-envelope.interface");
class KafkaEventPublisher {
    producerClient;
    producerServiceName;
    constructor(producerClient, producerServiceName = 'learnup-service') {
        this.producerClient = producerClient;
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
        const partitionKey = envelope.organizationId || envelope.eventId;
        await this.producerClient.send({
            topic,
            messages: [
                {
                    key: partitionKey,
                    value: JSON.stringify(envelope),
                    headers: {
                        'x-correlation-id': envelope.correlationId || '',
                        'x-organization-id': envelope.organizationId || '',
                    },
                },
            ],
        });
    }
}
exports.KafkaEventPublisher = KafkaEventPublisher;
//# sourceMappingURL=kafka-event-publisher.js.map