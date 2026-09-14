import { describe, expect, it } from 'vitest';
import { createEventEnvelope } from '../src/event/envelope.js';

describe('EventEnvelope Contract', () => {
  it('should create an EventEnvelope matching platform schema requirements', () => {
    const payload = {
      courseId: 'c-100',
      learnerId: 'l-200',
      score: 98.0,
    };

    const envelope = createEventEnvelope({
      eventType: 'CourseCompleted',
      organizationId: 'org-abc-123',
      producer: 'learning-service',
      data: payload,
    });

    expect(envelope.eventId).toBeDefined();
    expect(typeof envelope.eventId).toBe('string');
    expect(envelope.eventType).toBe('CourseCompleted');
    expect(envelope.version).toBe(1);
    expect(envelope.occurredAt).toBeDefined();
    expect(envelope.organizationId).toBe('org-abc-123');
    expect(envelope.producer).toBe('learning-service');
    expect(envelope.data).toEqual(payload);
  });

  it('should preserve custom eventId, version, and occurredAt when supplied', () => {
    const customTime = '2026-09-14T12:00:00.000Z';
    const envelope = createEventEnvelope({
      eventId: 'custom-event-uuid',
      eventType: 'PeerReviewAssigned',
      version: 2,
      occurredAt: customTime,
      organizationId: 'org-1',
      producer: 'assessment-service',
      data: { reviewCount: 5 },
    });

    expect(envelope.eventId).toBe('custom-event-uuid');
    expect(envelope.eventType).toBe('PeerReviewAssigned');
    expect(envelope.version).toBe(2);
    expect(envelope.occurredAt).toBe(customTime);
    expect(envelope.organizationId).toBe('org-1');
    expect(envelope.producer).toBe('assessment-service');
    expect(envelope.data).toEqual({ reviewCount: 5 });
  });
});
