/** The delivery that BR-254 (final score) and BR-232 (reminder) share: the bell and the e-mail of one notice. */
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { Logger } from '@nestjs/common';
import type { CurrentUser } from '@learnup/ts-common';
import { deliverNotice } from '../../src/infrastructure/clients/notification/deliver-notice';
import type {
  IEmailItem,
  INotificationItem,
} from '../../src/infrastructure/clients/notification/notification.client';
import { NotificationClient } from '../../src/infrastructure/clients/notification/notification.client';
import type { IUserDisplayName } from '../../src/infrastructure/clients/tenant/interfaces/user-display-name.interface';
import { TenantDirectoryClient } from '../../src/infrastructure/clients/tenant/tenant-directory.client';

const ORG = '00000000-0000-4000-8000-000000000001';
const PERSON = '00000000-0000-4000-8000-0000000000f1';
const lookupAs: CurrentUser = {
  userId: PERSON,
  role: 'LEARNER',
  organizationId: ORG,
  isAuthenticated: true,
};

class Notifications extends NotificationClient {
  readonly bells: INotificationItem[] = [];
  readonly emails: IEmailItem[] = [];
  constructor(
    private bellFailures = 0,
    private mailFailures = 0,
  ) {
    super();
  }
  send(item: INotificationItem): Promise<void> {
    if (this.bellFailures > 0) {
      this.bellFailures -= 1;
      return Promise.reject(new Error('bell down'));
    }
    this.bells.push(item);
    return Promise.resolve();
  }
  sendEmail(item: IEmailItem): Promise<void> {
    if (this.mailFailures > 0) {
      this.mailFailures -= 1;
      return Promise.reject(new Error('mail down'));
    }
    this.emails.push(item);
    return Promise.resolve();
  }
}

class Directory extends TenantDirectoryClient {
  constructor(private readonly email: string | null) {
    super();
  }
  getDisplayNames(
    _user: CurrentUser,
    userIds: string[],
  ): Promise<Map<string, IUserDisplayName>> {
    return Promise.resolve(
      new Map(
        userIds.map((id) => [
          id,
          {
            id,
            fullName: 'Học viên <Mẫu>',
            email: this.email,
            role: 'Learner',
            status: 'Active',
          } as unknown as IUserDisplayName,
        ]),
      ),
    );
  }
}

const notice = {
  organizationId: ORG,
  recipientUserId: PERSON,
  title: 'Tiêu đề <b>',
  message: 'Nội dung <i>có thẻ</i>',
  templateCode: 'SOME_NOTICE',
  about: 'something',
  lookupAs,
};
const silent = new Logger('test');
silent.warn = () => undefined;

describe('deliverNotice', () => {
  let previous: string | undefined;
  beforeEach(() => {
    previous = process.env.NOTICE_RETRY_DELAYS_MS;
    process.env.NOTICE_RETRY_DELAYS_MS = '1,1,1';
  });
  afterEach(() => {
    if (previous === undefined) delete process.env.NOTICE_RETRY_DELAYS_MS;
    else process.env.NOTICE_RETRY_DELAYS_MS = previous;
  });

  test('sends the bell and the e-mail of the same notice; the e-mail is plain text', async () => {
    const notifications = new Notifications();
    await deliverNotice(
      {
        notifications,
        tenant: new Directory('a@example.vn'),
        logger: silent,
      },
      { ...notice, type: 'ASSIGNMENT_RESULT', metadata: { x: '1' } },
    );
    assert.equal(notifications.bells.length, 1);
    assert.equal(notifications.bells[0].type, 'ASSIGNMENT_RESULT');
    assert.deepEqual(notifications.bells[0].metadata, { x: '1' });
    assert.equal(notifications.emails.length, 1);
    const mail = notifications.emails[0];
    assert.equal(mail.recipientEmail, 'a@example.vn');
    assert.equal(mail.templateCode, 'SOME_NOTICE');
    assert.equal(mail.subject, 'Tiêu đề <b>', 'the subject is not a body');
    assert.equal(
      mail.body,
      ['Xin chào Học viên Mẫu,', '', 'Nội dung icó thẻ/i'].join('\n'),
      'the angle brackets are cut, so the text cannot become HTML',
    );
  });

  test('a notice without a type or metadata leaves them out of the bell (the client then uses its default)', async () => {
    const notifications = new Notifications();
    await deliverNotice(
      { notifications, tenant: new Directory(null), logger: silent },
      notice,
    );
    assert.equal('type' in notifications.bells[0], false);
    assert.equal('metadata' in notifications.bells[0], false);
  });

  test('each channel is tried again on its own, then given up without throwing', async () => {
    const notifications = new Notifications(99, 1); // the bell never works; the e-mail works at the second try
    await deliverNotice(
      {
        notifications,
        tenant: new Directory('a@example.vn'),
        logger: silent,
      },
      notice,
    );
    assert.equal(notifications.bells.length, 0);
    assert.equal(notifications.emails.length, 1, 'the bell did not stop it');
  });
});
