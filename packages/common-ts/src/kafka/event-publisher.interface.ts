import { GenericEventEnvelope } from './generic-event-envelope.interface';

/**
 * Technology-neutral contract for publishing domain events.
 */
export interface EventPublisher {
  /**
   * Publishes an event payload wrapped inside a standard GenericEventEnvelope.
   *
   * @param topic Target Kafka topic
   * @param eventType Domain event type identifier
   * @param organizationId Tenant organization ID (used as partition key)
   * @param correlationId Distributed trace correlation ID
   * @param payload Domain event payload data
   */
  publish<T>(
    topic: string,
    eventType: string,
    organizationId: string | undefined,
    correlationId: string | undefined,
    payload: T,
  ): Promise<void>;

  /**
   * Publishes a pre-constructed GenericEventEnvelope.
   *
   * @param topic Target Kafka topic
   * @param envelope Standard event envelope
   */
  publishEnvelope<T>(
    topic: string,
    envelope: GenericEventEnvelope<T>,
  ): Promise<void>;
}
