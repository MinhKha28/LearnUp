/**
 * notification-service answers 201 also when the SMTP send failed: the outcome is in data.status. A failed send must be a
 * failed delivery, so the reminder (BR-232) and the final score notice (BR-254) are tried again and not lost silently.
 */
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { CurrentUser } from '@learnup/ts-common';
import { deliverNotice } from '../../src/infrastructure/clients/notification/deliver-notice';
import { HttpNotificationClient } from '../../src/infrastructure/clients/notification/http-notification.client';
import type { IUserDisplayName } from '../../src/infrastructure/clients/tenant/interfaces/user-display-name.interface';
import { TenantDirectoryClient } from '../../src/infrastructure/clients/tenant/tenant-directory.client';

const ORG = '00000000-0000-4000-8000-000000000001';
const PERSON = '00000000-0000-4000-8000-0000000000f1';
const mail = {
  recipientEmail: 'a@example.vn',
  subject: 'Sắp đến hạn chấm chéo',
  body: 'Xin chào A,\n\nBạn còn 2 bài nộp chưa chấm.',
  templateCode: 'PEER_REVIEW_REMINDER',
};

/** notification-service as a stub: the answers of /email/send are taken from `answers` in turn (the last one repeats). */
describe('the e-mail status of notification-service', () => {
  let server: Server;
  let answers: Array<{ status: number; body: string }>;
  let calls: number;
  let client: HttpNotificationClient;
  let previous: string | undefined;

  beforeEach(async () => {
    calls = 0;
    answers = [];
    server = createServer((request, response) => {
      request.resume();
      request.on('end', () => {
        const answer = answers[Math.min(calls, answers.length - 1)];
        calls += 1;
        response.writeHead(answer.status, {
          'content-type': 'application/json',
        });
        response.end(answer.body);
      });
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    client = new HttpNotificationClient({
      get: (key: string) =>
        key === 'NOTIFICATION_SERVICE_URL' ? url : undefined,
      getOrThrow: () => 'test-internal-key',
    } as unknown as ConfigService);
    previous = process.env.NOTICE_RETRY_DELAYS_MS;
    process.env.NOTICE_RETRY_DELAYS_MS = '1,1,1';
  });
  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
    if (previous === undefined) delete process.env.NOTICE_RETRY_DELAYS_MS;
    else process.env.NOTICE_RETRY_DELAYS_MS = previous;
  });

  const answer = (status: number, body: unknown) =>
    answers.push({
      status,
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });

  test('SENT is delivered', async () => {
    answer(201, { success: true, data: { status: 'SENT' } });
    await client.sendEmail(mail);
    assert.equal(calls, 1);
  });

  test('SIMULATED (mail switched off) is not a failure', async () => {
    answer(201, { success: true, data: { status: 'SIMULATED' } });
    await client.sendEmail(mail);
  });

  test('FAILED, answered with 201, is a failed delivery', async () => {
    answer(201, { success: true, data: { status: 'FAILED' } });
    await assert.rejects(
      client.sendEmail(mail),
      (error: { getResponse?: () => { code?: string } }) =>
        error.getResponse?.().code === 'EMAIL_DELIVERY_FAILED',
    );
  });

  test('an answer that has no status, or is not JSON, is not taken for a failure', async () => {
    answer(201, {});
    await client.sendEmail(mail);
    answers.length = 0;
    calls = 0;
    answer(201, 'not json');
    await client.sendEmail(mail);
  });

  test('a refusal with an HTTP error is still a failed delivery', async () => {
    answer(503, { success: false });
    await assert.rejects(client.sendEmail(mail));
  });

  test('deliverNotice tries the e-mail again after a FAILED answer, and stops at the first SENT', async () => {
    answer(201, { data: { status: 'FAILED' } });
    answer(201, { data: { status: 'FAILED' } });
    answer(201, { data: { status: 'SENT' } });
    const sent: number[] = [];
    const bells: unknown[] = [];
    const notifications = Object.assign(
      Object.create(client) as typeof client,
      {
        send: (item: unknown) => {
          bells.push(item);
          return Promise.resolve();
        },
      },
    );
    const silent = new Logger('test');
    silent.warn = () => undefined;
    const tenant = new (class extends TenantDirectoryClient {
      getDisplayNames(
        _user: CurrentUser,
        ids: string[],
      ): Promise<Map<string, IUserDisplayName>> {
        return Promise.resolve(
          new Map(
            ids.map((id) => [
              id,
              {
                id,
                fullName: 'A',
                email: 'a@example.vn',
                role: 'Learner',
                status: 'Active',
              },
            ]),
          ),
        );
      }
    })();
    await deliverNotice(
      { notifications, tenant, logger: silent },
      {
        organizationId: ORG,
        recipientUserId: PERSON,
        title: 'Sắp đến hạn chấm chéo',
        message: 'Bạn còn 2 bài nộp chưa chấm.',
        templateCode: 'PEER_REVIEW_REMINDER',
        about: 'the reminder',
        lookupAs: {
          userId: PERSON,
          role: 'LEARNER',
          organizationId: ORG,
          isAuthenticated: true,
        },
      },
    );
    sent.push(calls);
    assert.deepEqual(
      sent,
      [3],
      'two failed answers, then the one that was sent',
    );
    assert.equal(bells.length, 1, 'the bell did not wait for the e-mail');
  });
});
