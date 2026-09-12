import { EventPublisher } from './event-publisher.interface';
import { GenericEventEnvelope, createEventEnvelope } from './generic-event-envelope.interface';

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

/**
 * Kafka implementation of EventPublisher using KafkaJS or NestJS Kafka transporter.
 */
export class KafkaEventPublisher implements EventPublisher {
  constructor(
    private readonly producerClient: KafkaProducerClient,
    private readonly producerServiceName = 'learnup-service',
  ) {}

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
