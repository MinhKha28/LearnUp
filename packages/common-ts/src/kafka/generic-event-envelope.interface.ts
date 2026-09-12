import { v4 as uuidv4 } from 'uuid';

/**
 * Standardized generic event envelope wrapping all asynchronous Kafka event messages across LearnUP.
 * Matches the platform CloudEvent-compatible contract schema.
 */
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

/**
 * Factory function to construct a valid GenericEventEnvelope.
 */
export function createEventEnvelope<T>(
  params: CreateEventEnvelopeParams<T>,
): GenericEventEnvelope<T> {
  return {
    eventId: params.eventId ?? uuidv4(),
    eventType: params.eventType,
    occurredAt: params.occurredAt ?? new Date().toISOString(),
    producer: params.producer,
    payload: params.payload,
    organizationId: params.organizationId,
    correlationId: params.correlationId,
  };
}
