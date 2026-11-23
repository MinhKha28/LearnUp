import { message, SerializationFailure } from './relay.producer';
import type { OutboxRow } from './interfaces/outbox-row.interface';

describe('UC21.3 Course decision events', () => {
  const eventId = '019a0000-0000-7000-8000-000000000010';
  const courseId = '019a0000-0000-7000-8000-000000000001';
  const organizationId = '019a0000-0000-7000-8000-000000000002';
  const instructorId = '019a0000-0000-7000-8000-000000000003';
  const organizerId = '019a0000-0000-7000-8000-000000000004';
  const occurredAt = new Date('2026-11-10T08:00:00.000Z');

  const fixture = (eventType: string): OutboxRow => ({
    id: eventId,
    aggregate_type: 'Course',
    aggregate_id: courseId,
    organization_id: organizationId,
    event_type: eventType,
    occurred_at: occurredAt,
    attempts: 0,
    payload: {
      organizationId,
      courseId,
      instructorId,
      organizerId,
      courseName: 'Workplace Safety',
      versionNumber: 2,
      occurredAt: occurredAt.toISOString(),
      decidedAt: occurredAt.toISOString(),
      ...(eventType === 'CoursePublished'
        ? { publishedAt: occurredAt.toISOString() }
        : {
            rejectedAt: occurredAt.toISOString(),
            rejectionReason: 'Revise the rubric.',
          }),
    },
  });

  it.each(['CoursePublished', 'CourseRejected'])(
    'serializes %s',
    (eventType) => {
      const result = message(fixture(eventType));
      const envelope = JSON.parse(result.value);

      expect(envelope.eventType).toBe(eventType);
      expect(envelope.eventId).toBe(eventId);
      expect(envelope.data.courseId).toBe(courseId);
      expect(envelope.version).toBe(1);
    },
  );

  it('rejects an empty rejection reason', () => {
    const row = fixture('CourseRejected');

    row.payload = {
      ...(row.payload as Record<string, unknown>),
      rejectionReason: '',
    };

    expect(() => message(row)).toThrow(SerializationFailure);
  });
});
