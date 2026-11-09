import { message, SerializationFailure } from './relay.producer';
import type { OutboxRow } from './interfaces/outbox-row.interface';

describe('UC20 CourseSubmitted Outbox serialization', () => {
  const eventId = '019a0000-0000-7000-8000-000000000001';
  const organizationId = '019a0000-0000-7000-8000-000000000002';
  const courseId = '019a0000-0000-7000-8000-000000000003';
  const instructorId = '019a0000-0000-7000-8000-000000000004';
  const occurredAt = new Date('2026-11-08T05:00:00.000Z');

  const fixture = (): OutboxRow => ({
    id: eventId,
    aggregate_type: 'Course',
    aggregate_id: courseId,
    event_type: 'CourseSubmitted',
    organization_id: organizationId,
    occurred_at: occurredAt,
    attempts: 0,
    payload: {
      organizationId,
      courseId,
      occurredAt: occurredAt.toISOString(),
      instructorId,
      courseName: 'Workplace Safety',
      versionNumber: 1,
      submittedAt: occurredAt.toISOString(),
    },
  });

  it('publishes a valid envelope to the Course topic', () => {
    const result = message(fixture());
    expect(result.key).toBe(courseId);
    expect(JSON.parse(result.value)).toEqual({
      eventId,
      eventType: 'CourseSubmitted',
      version: 1,
      occurredAt: occurredAt.toISOString(),
      organizationId,
      producer: 'course-service',
      data: fixture().payload,
    });
  });

  it.each([
    { field: 'courseName', value: '' },
    { field: 'versionNumber', value: 0 },
    { field: 'instructorId', value: 'not-uuid' },
    { field: 'submittedAt', value: 'invalid-date' },
    { field: 'organizationId', value: '019a0000-0000-7000-8000-000000000099' },
  ])('rejects an invalid $field', ({ field, value }) => {
    const original = fixture();
    const payload = { ...(original.payload as Record<string, unknown>), [field]: value };
    expect(() => message({ ...original, payload } as OutboxRow))
      .toThrow(SerializationFailure);
  });
});
