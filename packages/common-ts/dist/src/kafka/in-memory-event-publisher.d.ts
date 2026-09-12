import { EventPublisher } from './event-publisher.interface';
import { GenericEventEnvelope } from './generic-event-envelope.interface';
export interface PublishedEventRecord<T = unknown> {
    topic: string;
    envelope: GenericEventEnvelope<T>;
}
export declare class InMemoryEventPublisher implements EventPublisher {
    private readonly publishedEvents;
    private readonly producerServiceName;
    constructor(producerServiceName?: string);
    publish<T>(topic: string, eventType: string, organizationId: string | undefined, correlationId: string | undefined, payload: T): Promise<void>;
    publishEnvelope<T>(topic: string, envelope: GenericEventEnvelope<T>): Promise<void>;
    getPublishedEvents(): readonly PublishedEventRecord[];
    clear(): void;
}
