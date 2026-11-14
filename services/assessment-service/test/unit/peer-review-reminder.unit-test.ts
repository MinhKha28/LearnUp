/**
 * BR-232 / UC49: the reminder before the review deadline reaches the reviewer by the bell and by e-mail. The schedule is
 * run with a repository, a notification-service and a tenant-service of its own, so what it hands over is read directly.
 */
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import type { ConfigService } from '@nestjs/config';
import type { CurrentUser } from '@learnup/ts-common';
import type {
  IEmailItem,
  INotificationItem,
} from '../../src/infrastructure/clients/notification/notification.client';
import { NotificationClient } from '../../src/infrastructure/clients/notification/notification.client';
import type { IUserDisplayName } from '../../src/infrastructure/clients/tenant/interfaces/user-display-name.interface';
import { TenantDirectoryClient } from '../../src/infrastructure/clients/tenant/tenant-directory.client';
import type { PeerReviewRepository } from '../../src/modules/peer-review/peer-review.repository';
import type { PeerReviewService } from '../../src/modules/peer-review/peer-review.service';
import { PeerReviewSchedule } from '../../src/modules/peer-review/peer-review.schedule';

const ORG = '00000000-0000-4000-8000-000000000001';
const CYCLE = '00000000-0000-4000-8000-0000000000c1';
const ASSIGNMENT = '00000000-0000-4000-8000-0000000000a1';
const R1 = '00000000-0000-4000-8000-0000000000e1';
const R2 = '00000000-0000-4000-8000-0000000000e2';
const R3 = '00000000-0000-4000-8000-0000000000e3';

const hours = (n: number) => new Date(Date.now() + n * 3_600_000);
const cycle = () => ({
  id: CYCLE,
  organizationId: ORG,
  assessmentId: ASSIGNMENT,
  reviewDueAt: hours(20), // reminder_hours is 24, so the window is open
  reminderHours: 24,
  assessment: { title: 'Bài tập quản lý thời gian' },
});

class RecordingNotifications extends NotificationClient {
  readonly bells: INotificationItem[] = [];
  readonly emails: IEmailItem[] = [];
  /** When set, the bell waits for it: a notification-service that is slow. */
  hold?: Promise<void>;
  async send(item: INotificationItem): Promise<void> {
    if (this.hold) await this.hold;
    this.bells.push(item);
  }
  sendEmail(item: IEmailItem): Promise<void> {
    this.emails.push(item);
    return Promise.resolve();
  }
}

/** A tenant-service with an e-mail address for some of the reviewers; `down` fails every call for that reviewer. */
class Directory extends TenantDirectoryClient {
  readonly asked: Array<{ user: CurrentUser; ids: string[] }> = [];
  constructor(
    private readonly emails: Record<string, string | null>,
    private readonly down: string[] = [],
  ) {
    super();
  }
  getDisplayNames(
    user: CurrentUser,
    userIds: string[],
  ): Promise<Map<string, IUserDisplayName>> {
    this.asked.push({ user, ids: userIds });
    if (userIds.some((id) => this.down.includes(id))) {
      return Promise.reject(new Error('tenant-service is down'));
    }
    return Promise.resolve(
      new Map(
        userIds.map((id) => [
          id,
          {
            id,
            fullName: `Học viên <${id.slice(-2)}>`,
            email: this.emails[id] ?? null,
            role: 'Learner',
            status: 'Active',
          } as unknown as IUserDisplayName,
        ]),
      ),
    );
  }
}

const build = (
  notifications: NotificationClient,
  tenant: TenantDirectoryClient,
  options: {
    claimed?: number;
    owed?: Map<string, number>;
  } = {},
) => {
  const claims: string[] = [];
  const repository = {
    findCyclesToClose: () => Promise.resolve([]),
    findCyclesToRemind: () => Promise.resolve([cycle()]),
    claimReminder: (cycleId: string) => {
      claims.push(cycleId);
      return Promise.resolve({ count: options.claimed ?? 1 });
    },
    pendingReviewCounts: () =>
      Promise.resolve(
        options.owed ??
          new Map([
            [R1, 2],
            [R2, 1],
          ]),
      ),
    findCyclesPastDeadline: () => Promise.resolve([]),
  };
  const schedule = new PeerReviewSchedule(
    repository as unknown as PeerReviewRepository,
    {} as PeerReviewService,
    notifications,
    tenant,
    { get: () => undefined } as unknown as ConfigService,
  );
  return { schedule, claims };
};

describe('BR-232 the reminder by the bell and by e-mail', () => {
  let previous: string | undefined;
  beforeEach(() => {
    previous = process.env.NOTICE_RETRY_DELAYS_MS;
    process.env.NOTICE_RETRY_DELAYS_MS = '1,1,1';
  });
  afterEach(() => {
    if (previous === undefined) delete process.env.NOTICE_RETRY_DELAYS_MS;
    else process.env.NOTICE_RETRY_DELAYS_MS = previous;
  });

  test('each reviewer who owes reviews gets the bell and the e-mail, with how many are left', async () => {
    const notifications = new RecordingNotifications();
    const { schedule } = build(
      notifications,
      new Directory({ [R1]: 'mot@example.vn', [R2]: 'hai@example.vn' }),
    );
    const run = await schedule.runOnce();
    await schedule.delivered();

    assert.equal(run.reminded, 1);
    assert.deepEqual(notifications.bells.map((b) => b.recipientUserId).sort(), [
      R1,
      R2,
    ]);
    const first = notifications.bells.find((b) => b.recipientUserId === R1)!;
    assert.equal(first.organizationId, ORG);
    assert.equal(first.title, 'Sắp đến hạn chấm chéo');
    assert.match(first.message, /Bạn còn 2 bài nộp chưa chấm/);
    assert.match(first.message, /Bài tập quản lý thời gian/);
    assert.deepEqual(first.metadata, {
      assignmentId: ASSIGNMENT,
      cycleId: CYCLE,
    });

    assert.deepEqual(notifications.emails.map((e) => e.recipientEmail).sort(), [
      'hai@example.vn',
      'mot@example.vn',
    ]);
    const mail = notifications.emails.find(
      (e) => e.recipientEmail === 'mot@example.vn',
    )!;
    assert.equal(mail.subject, 'Sắp đến hạn chấm chéo');
    assert.equal(mail.templateCode, 'PEER_REVIEW_REMINDER');
    assert.match(mail.body, /^Xin chào Học viên e1,/, 'angle brackets are cut');
    assert.match(mail.body, /Bạn còn 2 bài nộp chưa chấm/);
    assert.doesNotMatch(mail.body, /[<>]/);
  });

  test('the address is asked in the Organization of the cycle, for the reviewer', async () => {
    const directory = new Directory({ [R1]: 'mot@example.vn' });
    const { schedule } = build(new RecordingNotifications(), directory, {
      owed: new Map([[R1, 1]]),
    });
    await schedule.runOnce();
    await schedule.delivered();
    assert.equal(directory.asked.length, 1);
    assert.deepEqual(directory.asked[0].ids, [R1]);
    assert.equal(directory.asked[0].user.organizationId, ORG);
    assert.equal(directory.asked[0].user.userId, R1);
  });

  test('a reviewer without an e-mail address gets the bell only', async () => {
    const notifications = new RecordingNotifications();
    const { schedule } = build(
      notifications,
      new Directory({ [R1]: 'mot@example.vn', [R2]: null }),
    );
    await schedule.runOnce();
    await schedule.delivered();
    assert.equal(notifications.bells.length, 2);
    assert.deepEqual(
      notifications.emails.map((e) => e.recipientEmail),
      ['mot@example.vn'],
    );
  });

  test('a tenant-service that is down for one reviewer costs the others nothing, and that one still has the bell', async () => {
    const notifications = new RecordingNotifications();
    const { schedule } = build(
      notifications,
      new Directory({ [R1]: 'mot@example.vn', [R2]: 'hai@example.vn' }, [R1]),
      {
        owed: new Map([
          [R1, 1],
          [R2, 1],
          [R3, 3],
        ]),
      },
    );
    await schedule.runOnce();
    await schedule.delivered();
    assert.equal(notifications.bells.length, 3, 'everybody has the bell');
    assert.deepEqual(
      notifications.emails.map((e) => e.recipientEmail),
      ['hai@example.vn'],
      'R1 gave up after the tries; R3 has no address',
    );
  });

  test('the reminder is claimed before it is sent, and a cycle that was claimed by someone else sends nothing', async () => {
    const notifications = new RecordingNotifications();
    const { schedule, claims } = build(
      notifications,
      new Directory({ [R1]: 'mot@example.vn' }),
      { claimed: 0 },
    );
    const run = await schedule.runOnce();
    await schedule.delivered();
    assert.deepEqual(claims, [CYCLE]);
    assert.equal(run.reminded, 0);
    assert.equal(notifications.bells.length, 0);
    assert.equal(notifications.emails.length, 0);
  });

  test('a notification-service that is slow does not hold the run of the timer', async () => {
    const notifications = new RecordingNotifications();
    let release!: () => void;
    notifications.hold = new Promise<void>((resolve) => (release = resolve));
    const { schedule } = build(
      notifications,
      new Directory({ [R1]: 'mot@example.vn', [R2]: 'hai@example.vn' }),
    );
    const run = await schedule.runOnce(); // returns while the bells are still waiting
    assert.equal(run.reminded, 1);
    assert.equal(notifications.bells.length, 0, 'nothing delivered yet');
    release();
    await schedule.delivered();
    assert.equal(notifications.bells.length, 2);
    assert.equal(notifications.emails.length, 2);
  });
});
