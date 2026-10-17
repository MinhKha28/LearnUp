import type { ReactNode } from "react";
import { CheckCircleOutlined, ExclamationCircleOutlined, InfoCircleOutlined } from "@ant-design/icons";
import type { INotification } from "@/types/notification.types";
import "./notification.item.scss";

const formatTime = (iso: string) => new Date(iso).toLocaleString();

/** The type only picks the look of the icon; an unknown type looks like INFO. */
const typeView = (type: string): { tone: "info" | "success" | "warning"; icon: ReactNode } => {
  switch (type.toUpperCase()) {
    case "SUCCESS":
      return { tone: "success", icon: <CheckCircleOutlined /> };
    case "WARNING":
      return { tone: "warning", icon: <ExclamationCircleOutlined /> };
    default:
      return { tone: "info", icon: <InfoCircleOutlined /> };
  }
};

/** UC49: one notification; an unread one has a dot and is marked as read when it is opened (step 4). */
const NotificationItem = ({
  notification,
  onOpen,
}: {
  notification: INotification;
  onOpen: (notification: INotification) => void;
}) => {
  const view = typeView(notification.type);
  return (
    <button
      type="button"
      className={`notification-item${notification.isRead ? "" : " notification-item-unread"}`}
      onClick={() => onOpen(notification)}
    >
      <span className={`notification-item-icon notification-item-icon-${view.tone}`} aria-hidden="true">
        {view.icon}
      </span>
      <span className="notification-item-body">
        <strong>{notification.title}</strong>
        <span className="notification-item-message">{notification.message}</span>
        <small>{formatTime(notification.createdAt)}</small>
      </span>
      <span className="notification-item-dot" aria-label={notification.isRead ? "Read" : "Unread"} />
    </button>
  );
};

export default NotificationItem;
