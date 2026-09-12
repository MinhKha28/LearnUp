import { InMemoryEventPublisher } from '../../src/kafka/in-memory-event-publisher';

describe('InMemoryEventPublisher', () => {
  let publisher: InMemoryEventPublisher;

  beforeEach(() => {
    publisher = new InMemoryEventPublisher('identity-service');
  });

  it('should store published events in-memory for assertion', async () => {
    const payload = { userId: 'usr_test', status: 'ACTIVE' };

    await publisher.publish(
      'learnup.identity.user-registered.v1',
      'identity.user.registered',
      'org_123',
      'corr_999',
      payload,
    );

    const published = publisher.getPublishedEvents();
    expect(published).toHaveLength(1);
    expect(published[0].topic).toBe('learnup.identity.user-registered.v1');
    expect(published[0].envelope.organizationId).toBe('org_123');
    expect(published[0].envelope.correlationId).toBe('corr_999');
    expect(published[0].envelope.payload).toEqual(payload);
  });
});
