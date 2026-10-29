export interface INotificationItem {
  organizationId: string;
  recipientUserId: string;
  title: string;
  message: string;
  /** Free text the screen can use to link to the item, e.g. {"assignmentId": "...", "cycleId": "..."}. */
  metadata?: Record<string, string>;
}

/** Tells notification-service to put a notification in the bell of a user (UC49). Best effort: the caller catches errors. */
export abstract class NotificationClient {
  abstract send(item: INotificationItem): Promise<void>;
}
