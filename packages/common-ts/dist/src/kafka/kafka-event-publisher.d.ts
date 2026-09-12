import { EventPublisher } from './event-publisher.interface';
import { GenericEventEnvelope } from './generic-event-envelope.interface';
export interface KafkaProducerClient {
    send(record: {
        topic: string;
        messages: Array<{
            key?: string | Buffer | null;
            value: string | Buffer | null;
            headers?: Record<string, string>;
        }>;
    }): Promise<unknown>;
}
export declare class KafkaEventPublisher implements EventPublisher {
    private readonly producerClient;
    private readonly producerServiceName;
    constructor(producerClient: KafkaProducerClient, producerServiceName?: string);
    publish<T>(topic: string, eventType: string, organizationId: string | undefined, correlationId: string | undefined, payload: T): Promise<void>;
    publishEnvelope<T>(topic: string, envelope: GenericEventEnvelope<T>): Promise<void>;
}
