import { useCallback, useEffect, useState } from "react";
import { BellOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import { Button, Pagination, Segmented, Skeleton } from "antd";
import NotificationItem from "@/components/notification/notification.item";
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationRead,
  NOTIFICATIONS_CHANGED_EVENT,
} from "@/services/notification.service";
import type { INotification, INotificationPage } from "@/types/notification.types";
import "./notification.page.scss";

const PAGE_SIZE = 10;

type Filter = "all" | "unread";

/** UC49: the full list of the notifications of the signed-in user, newest first, for every role. */
const NotificationPage = () => {
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<INotificationPage | null>(null);
  const [unread, setUnread] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setData(await fetchNotifications(page, PAGE_SIZE, filter === "unread"));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  const loadUnread = useCallback(async () => {
    try {
      setUnread((await fetchUnreadCount()).unreadCount);
    } catch {
      setUnread(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadUnread();
  }, [loadUnread]);

  const openNotification = async (notification: INotification) => {
    if (notification.isRead) return;
    setData((current) =>
      current
        ? { ...current, items: current.items.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item)) }
        : current,
    );
    setUnread((count) => (count === null ? count : Math.max(0, count - 1)));
    try {
      await markNotificationRead(notification.id);
    } catch {
      void load();
      void loadUnread();
    }
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
  };

  const changeFilter = (value: Filter) => {
    setPage(0);
    setFilter(value);
  };

  const empty = !failed && data !== null && data.items.length === 0;

  return (
    <div className="notification-page">
      <div className="notification-page-head">
        <div className="notification-page-title">
          <h1>Notifications</h1>
          <p>
            Updates about your Courses, assessments and reviews.
            {unread !== null && unread > 0 && <span className="notification-page-count">{unread} unread</span>}
          </p>
        </div>
        <Segmented
          value={filter}
          onChange={(value) => changeFilter(value as Filter)}
          options={[
            { label: "All", value: "all" },
            { label: "Unread", value: "unread" },
          ]}
        />
      </div>

      <div className="notification-page-card">
        {loading && !data && !failed && (
          <div className="notification-page-skeleton">
            <Skeleton active avatar paragraph={{ rows: 2 }} />
            <Skeleton active avatar paragraph={{ rows: 2 }} />
            <Skeleton active avatar paragraph={{ rows: 2 }} />
          </div>
        )}

        {failed && (
          <div className="notification-page-state notification-page-state-error" role="alert">
            <span className="notification-page-state-icon">
              <ExclamationCircleOutlined />
            </span>
            <strong>Unable to load notifications</strong>
            <p>Something went wrong. Please try again.</p>
            <Button onClick={() => void load()}>Try again</Button>
          </div>
        )}

        {empty && (
          <div className="notification-page-state">
            <span className="notification-page-state-icon">
              <BellOutlined />
            </span>
            <strong>{filter === "unread" ? "You're all caught up" : "No notifications yet"}</strong>
            <p>
              {filter === "unread"
                ? "You have no unread notifications."
                : "When something needs your attention, it will show up here."}
            </p>
            {filter === "unread" && <Button onClick={() => changeFilter("all")}>View all notifications</Button>}
          </div>
        )}

        {!failed &&
          data?.items.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} onOpen={openNotification} />
          ))}
      </div>

      {data && data.totalElements > PAGE_SIZE && (
        <Pagination
          className="notification-page-pagination"
          current={page + 1}
          pageSize={PAGE_SIZE}
          total={data.totalElements}
          showSizeChanger={false}
          onChange={(next) => setPage(next - 1)}
        />
      )}
    </div>
  );
};

export default NotificationPage;
