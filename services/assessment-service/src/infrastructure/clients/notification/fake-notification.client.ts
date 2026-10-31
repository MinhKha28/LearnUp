import {
  IEmailItem,
  INotificationItem,
  NotificationClient,
} from './notification.client';

/** Keeps what was sent, so a test can read it; used when NOTIFICATION_CLIENT_MODE is not http. */
export class FakeNotificationClient extends NotificationClient {
  readonly sent: INotificationItem[] = [];
  readonly emails: IEmailItem[] = [];

  send(item: INotificationItem): Promise<void> {
    this.sent.push(item);
    return Promise.resolve();
  }

  sendEmail(item: IEmailItem): Promise<void> {
    this.emails.push(item);
    return Promise.resolve();
  }
}
