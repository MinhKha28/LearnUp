import { createEventEnvelope } from '../../src/kafka/generic-event-envelope.interface';

describe('GenericEventEnvelope', () => {
  it('should construct valid event envelope matching contract', () => {
    const payload = { userId: 'usr_1', email: 'user@enterprise.com' };
    const envelope = createEventEnvelope({
      eventType: 'learnup.identity.user-registered.v1',
      producer: 'identity-service',
      payload,
      organizationId: 'org_123',
      correlationId: 'corr_456',
    });

    expect(envelope.eventId).toBeDefined();
    expect(envelope.eventType).toBe('learnup.identity.user-registered.v1');
    expect(envelope.producer).toBe('identity-service');
    expect(envelope.organizationId).toBe('org_123');
    expect(envelope.correlationId).toBe('corr_456');
    expect(envelope.payload).toEqual(payload);
    expect(envelope.occurredAt).toBeDefined();
  });
});
