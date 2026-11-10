export interface INotificationItem {
  organizationId: string;
  recipientUserId: string;
  title: string;
  message: string;
  /** Free text the screen can use to link to the item, e.g. {"assignmentId": "...", "cycleId": "..."}. */
  metadata?: Record<string, string>;
}

export interface IEmailItem {
  recipientEmail: string;
  subject: string;
  /** Plain text; the caller does not put anything a person typed in it unescaped. */
  body: string;
  /** Names the kind of mail in the log of notification-service. */
  templateCode: string;
}

/** Tells notification-service to put a notification in the bell of a user (UC49). Best effort: the caller catches errors. */
export abstract class NotificationClient {
  abstract send(item: INotificationItem): Promise<void>;
  /** Asks notification-service to send an e-mail. Best effort: the caller catches errors. */
  abstract sendEmail(item: IEmailItem): Promise<void>;
}
