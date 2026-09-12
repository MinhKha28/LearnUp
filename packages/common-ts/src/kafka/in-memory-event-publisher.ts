import { EventPublisher } from './event-publisher.interface';
import { GenericEventEnvelope, createEventEnvelope } from './generic-event-envelope.interface';

export interface PublishedEventRecord<T = unknown> {
  topic: string;
  envelope: GenericEventEnvelope<T>;
}

/**
 * In-memory implementation of EventPublisher useful for unit and integration testing.
 */
export class InMemoryEventPublisher implements EventPublisher {
  private readonly publishedEvents: PublishedEventRecord[] = [];
  private readonly producerServiceName: string;

  constructor(producerServiceName = 'test-service') {
    this.producerServiceName = producerServiceName;
  }

  async publish<T>(
    topic: string,
    eventType: string,
    organizationId: string | undefined,
    correlationId: string | undefined,
    payload: T,
  ): Promise<void> {
    const envelope = createEventEnvelope({
      eventType,
      producer: this.producerServiceName,
      payload,
      organizationId,
      correlationId,
    });
    return this.publishEnvelope(topic, envelope);
  }

  async publishEnvelope<T>(
    topic: string,
    envelope: GenericEventEnvelope<T>,
  ): Promise<void> {
    this.publishedEvents.push({ topic, envelope });
  }

  getPublishedEvents(): readonly PublishedEventRecord[] {
    return [...this.publishedEvents];
  }

  clear(): void {
    this.publishedEvents.length = 0;
  }
}
