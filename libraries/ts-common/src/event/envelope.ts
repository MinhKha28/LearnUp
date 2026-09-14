/**
 * Canonical envelope schema for all domain events published to Apache Kafka.
 * Conforms to contracts/events/event-envelope.schema.json.
 */
export interface EventEnvelope<T> {
  eventId: string;
  eventType: string;
  version: number;
  occurredAt: string;
  organizationId: string;
  producer: string;
  data: T;
}

/**
 * Factory creating an EventEnvelope instance conforming to the platform schema.
 */
export function createEventEnvelope<T>(params: {
  eventType: string;
  organizationId: string;
  producer: string;
  data: T;
  eventId?: string;
  version?: number;
  occurredAt?: string;
}): EventEnvelope<T> {
  return {
    eventId: params.eventId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `evt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`),
    eventType: params.eventType,
    version: params.version && params.version > 0 ? params.version : 1,
    occurredAt: params.occurredAt || new Date().toISOString(),
    organizationId: params.organizationId,
    producer: params.producer,
    data: params.data,
  };
}
