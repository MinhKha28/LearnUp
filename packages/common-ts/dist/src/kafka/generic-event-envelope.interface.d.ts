export interface GenericEventEnvelope<T = unknown> {
    eventId: string;
    eventType: string;
    occurredAt: string;
    producer: string;
    payload: T;
    organizationId?: string;
    correlationId?: string;
}
export interface CreateEventEnvelopeParams<T> {
    eventType: string;
    producer: string;
    payload: T;
    organizationId?: string;
    correlationId?: string;
    eventId?: string;
    occurredAt?: string;
}
export declare function createEventEnvelope<T>(params: CreateEventEnvelopeParams<T>): GenericEventEnvelope<T>;
