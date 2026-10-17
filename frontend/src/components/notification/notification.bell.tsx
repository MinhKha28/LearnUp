import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Popover } from "antd";
import { BellOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import NotificationItem from "@/components/notification/notification.item";
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationRead,
  NOTIFICATIONS_CHANGED_EVENT,
} from "@/services/notification.service";
import type { INotification } from "@/types/notification.types";
import "./notification.bell.scss";

const LATEST_SIZE = 8;
const POLL_MS = 60_000;

/**
 * UC49: the bell of the top bar of every role. The badge is the number of unread notifications; the drop-down shows
 * the newest ones, newest first, and opens the full list. `basePath` is the role root, e.g. "/learner".
 */
const NotificationBell = ({ basePath }: { basePath: string }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<INotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const refreshCount = useCallback(async () => {
    try {
      setUnread((await fetchUnreadCount()).unreadCount);
    } catch {
      // the badge keeps its last value; the next poll tries again
    }
  }, []);

  useEffect(() => {
    void refreshCount();
    const timer = setInterval(() => void refreshCount(), POLL_MS);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refreshCount);
    return () => {
      clearInterval(timer);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refreshCount);
    };
  }, [refreshCount]);

  const loadLatest = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setItems((await fetchNotifications(0, LATEST_SIZE, false)).items);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void loadLatest();
      void refreshCount();
    }
  }, [open, loadLatest, refreshCount]);

  const openNotification = async (notification: INotification) => {
    if (notification.isRead) return;
    // shown as read at once; if the server refuses, the real state is loaded again
    setItems((current) => current.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item)));
    setUnread((count) => Math.max(0, count - 1));
    try {
      await markNotificationRead(notification.id);
    } catch {
      void loadLatest();
      void refreshCount();
    }
  };

  const viewAll = () => {
    setOpen(false);
    navigate(`${basePath}/notifications`);
  };

  const content = (
    <div className="notification-bell-panel">
      <div className="notification-bell-head">
        <strong>Notifications</strong>
        {unread > 0 && <span>{unread} unread</span>}
      </div>
      <div className="notification-bell-list">
        {loading && items.length === 0 && <p className="notification-bell-empty">Loading...</p>}
        {failed && <p className="notification-bell-empty">Unable to load notifications. Try again later.</p>}
        {!loading && !failed && items.length === 0 && <p className="notification-bell-empty">You have no notifications.</p>}
        {items.map((notification) => (
          <NotificationItem key={notification.id} notification={notification} onOpen={openNotification} />
        ))}
      </div>
      <button type="button" className="notification-bell-all" onClick={viewAll}>
        View all notifications
      </button>
    </div>
  );

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="bottomRight"
      arrow={false}
      content={content}
      overlayClassName="notification-bell-popover"
    >
      <Badge count={unread} size="small" overflowCount={99}>
        <Button className="notification-bell-button" type="text" icon={<BellOutlined />} aria-label="Notifications" />
      </Badge>
    </Popover>
  );
};

export default NotificationBell;
