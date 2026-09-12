import { GenericEventEnvelope } from './generic-event-envelope.interface';
export interface EventPublisher {
    publish<T>(topic: string, eventType: string, organizationId: string | undefined, correlationId: string | undefined, payload: T): Promise<void>;
    publishEnvelope<T>(topic: string, envelope: GenericEventEnvelope<T>): Promise<void>;
}
