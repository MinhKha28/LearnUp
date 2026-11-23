import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import type { CurrentUser } from '@learnup/ts-common';
import type {
  IEmailItem,
  INotificationItem,
} from '../../src/infrastructure/clients/notification/notification.client';
import { NotificationClient } from '../../src/infrastructure/clients/notification/notification.client';
import type { IUserDisplayName } from '../../src/infrastructure/clients/tenant/interfaces/user-display-name.interface';
import { TenantDirectoryClient } from '../../src/infrastructure/clients/tenant/tenant-directory.client';
import type { InstructorSubmissionsRepository } from '../../src/modules/instructor-submissions/instructor-submissions.repository';
import { InstructorSubmissionsService } from '../../src/modules/instructor-submissions/instructor-submissions.service';
import type { CourseServiceClient } from '../../src/infrastructure/clients/course/course-service.client';
import { instructor, MemoryStorage } from './fixtures';

const LEARNER = '00000000-0000-4000-8000-0000000000c1';
const ASSIGNMENT = {
  assignmentId: '00000000-0000-4000-8000-0000000000a1',
  courseId: '00000000-0000-4000-8000-000000000004',
  organizationId: '00000000-0000-4000-8000-000000000001',
  title: 'Bài tập',
  finalScore: 80,
};

/** A tenant-service that fails `failures` times before it answers, and may have no e-mail address for the Learner. */
class FlakyTenant extends TenantDirectoryClient {
  calls = 0;
  constructor(
    private failures: number,
    private readonly email: string | null,
  ) {
    super();
  }
  getDisplayNames(
    _user: CurrentUser,
    userIds: string[],
  ): Promise<Map<string, IUserDisplayName>> {
    this.calls += 1;
    if (this.failures > 0) {
      this.failures -= 1;
      return Promise.reject(new Error('tenant-service is down'));
    }
    return Promise.resolve(
      new Map(
        userIds.map((id) => [
          id,
          {
            id,
            fullName: 'Học viên Mẫu',
            email: this.email,
            role: 'Learner',
            status: 'Active',
          } as unknown as IUserDisplayName,
        ]),
      ),
    );
  }
}

/** A notification-service whose bell fails `bellFailures` times before it answers. */
class FlakyNotifications extends NotificationClient {
  bellCalls = 0;
  readonly bells: INotificationItem[] = [];
  readonly emails: IEmailItem[] = [];
  constructor(private bellFailures: number) {
    super();
  }
  send(item: INotificationItem): Promise<void> {
    this.bellCalls += 1;
    if (this.bellFailures > 0) {
      this.bellFailures -= 1;
      return Promise.reject(new Error('notification-service is down'));
    }
    this.bells.push(item);
    return Promise.resolve();
  }
  sendEmail(item: IEmailItem): Promise<void> {
    this.emails.push(item);
    return Promise.resolve();
  }
}

const tell = (tenant: FlakyTenant, notifications: FlakyNotifications) => {
  const service = new InstructorSubmissionsService(
    {} as InstructorSubmissionsRepository,
    {} as CourseServiceClient,
    tenant,
    new MemoryStorage(),
    notifications,
  );
  return (
    service as unknown as {
      tellLearnerFinalized: (
        user: CurrentUser,
        learnerId: string,
        assignment: typeof ASSIGNMENT,
      ) => Promise<void>;
    }
  ).tellLearnerFinalized(instructor, LEARNER, ASSIGNMENT);
};

describe('BR-254 delivery of the notice of the final score', () => {
  let previous: string | undefined;
  beforeEach(() => {
    previous = process.env.NOTICE_RETRY_DELAYS_MS;
    process.env.NOTICE_RETRY_DELAYS_MS = '1,1,1';
  });
  afterEach(() => {
    if (previous === undefined) delete process.env.NOTICE_RETRY_DELAYS_MS;
    else process.env.NOTICE_RETRY_DELAYS_MS = previous;
  });

  test('a tenant-service that is down for a moment does not cost the Learner the e-mail', async () => {
    const tenant = new FlakyTenant(2, 'hoc.vien@example.vn');
    const notifications = new FlakyNotifications(0);
    await tell(tenant, notifications);
    assert.equal(tenant.calls, 3, 'the address was looked up again twice');
    assert.equal(notifications.emails.length, 1);
    assert.equal(notifications.emails[0].recipientEmail, 'hoc.vien@example.vn');
    assert.equal(
      notifications.bells.length,
      1,
      'the bell does not depend on the lookup',
    );
  });

  test('a bell that fails is tried again, and the e-mail does not wait for it', async () => {
    const tenant = new FlakyTenant(0, 'hoc.vien@example.vn');
    const notifications = new FlakyNotifications(3);
    await tell(tenant, notifications);
    assert.equal(notifications.bellCalls, 4);
    assert.equal(notifications.bells.length, 1);
    assert.equal(notifications.emails.length, 1);
  });

  test('a Learner without an e-mail address gets the bell only, and nobody keeps asking', async () => {
    const tenant = new FlakyTenant(0, null);
    const notifications = new FlakyNotifications(0);
    await tell(tenant, notifications);
    assert.equal(
      tenant.calls,
      1,
      'an address that is not there is not an error',
    );
    assert.equal(notifications.emails.length, 0);
    assert.equal(notifications.bells.length, 1);
  });

  test('when everything stays down it gives up and does not throw', async () => {
    const tenant = new FlakyTenant(99, 'hoc.vien@example.vn');
    const notifications = new FlakyNotifications(99);
    await tell(tenant, notifications);
    assert.equal(tenant.calls, 4, 'one attempt and one after each delay');
    assert.equal(notifications.bellCalls, 4);
    assert.equal(notifications.bells.length + notifications.emails.length, 0);
  });
});
