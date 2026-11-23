import { Logger } from '@nestjs/common';
import type { CurrentUser } from '@learnup/ts-common';
import { TenantDirectoryClient } from '../tenant/tenant-directory.client';
import { NotificationClient } from './notification.client';
import { noticeRetryDelaysMs, withRetries } from './retry';

/** What one person is told: the bell and the e-mail of the same notice. */
export interface INoticeDelivery {
  organizationId: string;
  recipientUserId: string;
  title: string;
  message: string;
  /** What the bell shows the notice as (the filters and the icon of notification-service). */
  type?: string;
  metadata?: Record<string, string>;
  /** Names the kind of mail in the log of notification-service. */
  templateCode: string;
  /** What the log says the notice is about, e.g. "the final score of <assignment>". */
  about: string;
  /** Who asks tenant-service for the address; the Instructor of the request, or the Learner when nobody asked (a timer). */
  lookupAs: CurrentUser;
}

/**
 * The bell and the e-mail of a notice that this service sends itself by REST (BR-254, BR-232). Each channel is tried again
 * a few times (see `withRetries`), on its own: a notification that cannot be sent never undoes what already happened, and
 * neither channel stops the other. The e-mail address is looked up inside the retried work, so a tenant-service that is down
 * for a moment is covered too; a person without an address gets the bell only and nobody keeps asking.
 */
export async function deliverNotice(
  deps: {
    notifications: NotificationClient;
    tenant: TenantDirectoryClient;
    logger: Logger;
  },
  notice: INoticeDelivery,
): Promise<void> {
  const { notifications, tenant, logger } = deps;
  const who = notice.recipientUserId;
  const delays = noticeRetryDelaysMs();
  const failed = (what: string) => (error: unknown, attempt: number) =>
    logger.warn(
      `${what} of ${who} failed, attempt ${attempt} follows: ${String(error)}`,
    );
  const bell = async () => {
    try {
      await withRetries(
        () =>
          notifications.send({
            organizationId: notice.organizationId,
            recipientUserId: who,
            title: notice.title,
            message: notice.message,
            ...(notice.type ? { type: notice.type } : {}),
            ...(notice.metadata ? { metadata: notice.metadata } : {}),
          }),
        delays,
        failed('The bell'),
      );
    } catch (error) {
      logger.warn(
        `The bell of ${who} was not told about ${notice.about}: ${String(error)}`,
      );
    }
  };
  const mail = async () => {
    try {
      await withRetries(
        async () => {
          const person = (
            await tenant.getDisplayNames(notice.lookupAs, [who])
          ).get(who);
          if (!person?.email) return;
          // The text goes out as plain text: a title with angle brackets would turn the whole mail into HTML.
          const plain = (text: string) => text.replace(/[<>]/g, '');
          await notifications.sendEmail({
            recipientEmail: person.email,
            subject: notice.title,
            body: `Xin chào ${plain(person.fullName)},\n\n${plain(notice.message)}`,
            templateCode: notice.templateCode,
          });
        },
        delays,
        failed('The e-mail'),
      );
    } catch (error) {
      logger.warn(
        `The e-mail of ${who} about ${notice.about} was not sent: ${String(error)}`,
      );
    }
  };
  await Promise.all([bell(), mail()]);
}
