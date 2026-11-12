import { CourseAuditRelayService } from './audit-relay.service';
import type { CourseAuditRelayRepository, CourseAuditRow } from './audit-relay.repository';
import type { AuditClient } from '../../infrastructure/clients/audit/audit.client';

describe('UC23 Course Audit relay', () => {
  const row = {
    id: '019a0000-0000-7000-8000-000000000008',
    organization_id: '019a0000-0000-7000-8000-000000000002',
    aggregate_id: '019a0000-0000-7000-8000-000000000004',
    occurred_at: new Date('2026-11-10T12:00:00.000Z'),
    attempts: 0,
    lease_until: new Date('2026-11-10T12:00:30.000Z'),
    payload: {
      organizationId: '019a0000-0000-7000-8000-000000000002',
      actorUserId: '019a0000-0000-7000-8000-000000000007',
      actorRole: 'ORGANIZER',
      actionType: 'COURSE_OWNERSHIP_TRANSFERRED',
      targetResourceType: 'CourseChain',
      targetResourceId: '019a0000-0000-7000-8000-000000000004',
      courseId: '019a0000-0000-7000-8000-000000000003',
      fromInstructorId: '019a0000-0000-7000-8000-000000000005',
      toInstructorId: '019a0000-0000-7000-8000-000000000006',
      occurredAt: '2026-11-10T12:00:00.000Z',
    },
  } as CourseAuditRow;

  const repository = {
    claim: jest.fn(),
    complete: jest.fn(),
    retry: jest.fn(),
  };
  const client = { isConfigured: jest.fn(), record: jest.fn() };
  const service = new CourseAuditRelayService(
    repository as unknown as CourseAuditRelayRepository,
    client as unknown as AuditClient,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    client.isConfigured.mockReturnValue(true);
    repository.claim.mockResolvedValueOnce(row).mockResolvedValue(null);
    repository.complete.mockResolvedValue(undefined);
    repository.retry.mockResolvedValue(undefined);
    client.record.mockResolvedValue(undefined);
  });

  it('delivers Audit with the stable Outbox ID and marks only the Audit row published', async () => {
    await service.tick();
    expect(client.record).toHaveBeenCalledWith(
      row.id, expect.objectContaining({ occurredAt: row.occurred_at.toISOString() }),
    );
    expect(repository.complete).toHaveBeenCalledWith(row);
    expect(repository.retry).not.toHaveBeenCalled();
  });

  it('retains and retries the event when Audit Service is unavailable', async () => {
    client.record.mockRejectedValueOnce(new Error('network'));
    await service.tick();
    expect(repository.complete).not.toHaveBeenCalled();
    expect(repository.retry).toHaveBeenCalledWith(row, 'AUDIT_DELIVERY_FAILED');
  });

  it('does not claim or lose events without AUDIT_SERVICE_URL', async () => {
    client.isConfigured.mockReturnValue(false);
    await service.tick();
    expect(repository.claim).not.toHaveBeenCalled();
    expect(client.record).not.toHaveBeenCalled();
  });

  it('does not send malformed payload outside the event Organization', async () => {
    repository.claim.mockReset().mockResolvedValueOnce({
      ...row, payload: { ...(row.payload as object), organizationId: 'another-organization' },
    }).mockResolvedValue(null);
    await service.tick();
    expect(client.record).not.toHaveBeenCalled();
    expect(repository.retry).toHaveBeenCalledWith(
      expect.anything(), 'AUDIT_DELIVERY_FAILED',
    );
  });
});
