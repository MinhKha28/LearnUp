/** UC49: an in-app notification as notification-service returns it. */
export interface INotification {
  id: string;
  organizationId: string | null;
  recipientUserId: string;
  title: string;
  message: string;
  type: string;
  channel: string;
  isRead: boolean;
  readAt: string | null;
  metadata: string | null;
  createdAt: string;
}

/** notification-service is the Java service: its page uses page (from 0), size and totalElements. */
export interface INotificationPage {
  items: INotification[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export interface IUnreadCount {
  userId: string;
  unreadCount: number;
}
