import { apiGet, apiPatch } from "@/services/api.client";
import type { INotification, INotificationPage, IUnreadCount } from "@/types/notification.types";

/** The full list tells the bell, on the same page, that the badge changed. */
export const NOTIFICATIONS_CHANGED_EVENT = "learnup:notifications-changed";

const NOTIFICATIONS_PATH = "/api/v1/notifications";

/** UC49: the notifications of the signed-in user, newest first. `page` starts at 0. */
export const fetchNotifications = (page: number, size: number, unreadOnly: boolean, signal?: AbortSignal) =>
  apiGet<INotificationPage>(NOTIFICATIONS_PATH, { params: { page, size, unreadOnly }, signal });

/** UC49: the number on the badge of the bell. */
export const fetchUnreadCount = (signal?: AbortSignal) =>
  apiGet<IUnreadCount>(`${NOTIFICATIONS_PATH}/unread-count`, { signal });

/** UC49 step 4: mark one notification as read. */
export const markNotificationRead = (id: string) =>
  apiPatch<INotification>(`${NOTIFICATIONS_PATH}/${encodeURIComponent(id)}/read`, undefined);
