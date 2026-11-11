// @vitest-environment jsdom
// UC49 step 4: opening a notification marks it as read — once, with the count kept in step, and recovered on failure.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/notification.service", () => ({
  NOTIFICATIONS_CHANGED_EVENT: "learnup:notifications-changed",
  fetchNotifications: vi.fn(),
  fetchUnreadCount: vi.fn(),
  markNotificationRead: vi.fn(),
}));

import * as api from "@/services/notification.service";
import NotificationBell from "./notification.bell";
import NotificationPage from "./notification.page";

const notice = (over: Record<string, unknown> = {}) => ({
  id: "n1",
  organizationId: "o1",
  recipientUserId: "u1",
  title: "Khóa học đã được phê duyệt",
  message: "Khóa học «Kế hoạch» đã được phê duyệt.",
  type: "COURSE_APPROVAL",
  channel: "IN_APP",
  isRead: false,
  readAt: null,
  createdAt: "2026-11-05T01:33:02Z",
  ...over,
});

const page = (items: unknown[]) => ({
  items,
  page: 0,
  size: 10,
  totalElements: items.length,
  totalPages: 1,
  first: true,
  last: true,
});

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false,
    }),
  });
});

beforeEach(() => {
  vi.mocked(api.fetchUnreadCount).mockResolvedValue({ userId: "u1", unreadCount: 1 } as never);
  vi.mocked(api.fetchNotifications).mockResolvedValue(page([notice()]) as never);
  vi.mocked(api.markNotificationRead).mockResolvedValue(notice({ isRead: true }) as never);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("UC49 mark as read on the page", () => {
  it("marks an unread notification once, shows it read and lowers the count", async () => {
    const changed = vi.fn();
    window.addEventListener("learnup:notifications-changed", changed);
    render(<NotificationPage />);
    fireEvent.click(await screen.findByText("Khóa học đã được phê duyệt"));

    await waitFor(() => expect(api.markNotificationRead).toHaveBeenCalledWith("n1"));
    await screen.findByLabelText("Đã đọc");
    expect(screen.queryByText("1 chưa đọc")).toBeNull();
    await waitFor(() => expect(changed).toHaveBeenCalledOnce());
    window.removeEventListener("learnup:notifications-changed", changed);

    fireEvent.click(screen.getByText("Khóa học đã được phê duyệt"));
    expect(api.markNotificationRead).toHaveBeenCalledOnce(); // already read: no second request
  });

  it("does not call the server for a notification that is already read", async () => {
    vi.mocked(api.fetchNotifications).mockResolvedValue(page([notice({ isRead: true })]) as never);
    vi.mocked(api.fetchUnreadCount).mockResolvedValue({ userId: "u1", unreadCount: 0 } as never);
    render(<NotificationPage />);
    fireEvent.click(await screen.findByText("Khóa học đã được phê duyệt"));
    expect(api.markNotificationRead).not.toHaveBeenCalled();
  });

  it("reloads the real state when the server refuses", async () => {
    vi.mocked(api.markNotificationRead).mockRejectedValueOnce(new Error("404"));
    render(<NotificationPage />);
    fireEvent.click(await screen.findByText("Khóa học đã được phê duyệt"));

    await waitFor(() => expect(api.fetchNotifications).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(api.fetchUnreadCount).toHaveBeenCalledTimes(2));
    // the reloaded server state shows the item unread again
    await waitFor(() =>
      expect(document.querySelector(".notification-item-dot")?.getAttribute("aria-label")).toBe("Chưa đọc"),
    );
  });
});

describe("UC49 mark as read in the bell", () => {
  it("marks the notification read from the drop-down and lowers the badge", async () => {
    render(
      <MemoryRouter>
        <NotificationBell basePath="/learner" />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Thông báo" }));
    fireEvent.click(await screen.findByText("Khóa học đã được phê duyệt"));

    await waitFor(() => expect(api.markNotificationRead).toHaveBeenCalledWith("n1"));
    await waitFor(() => expect(screen.queryByText("1 chưa đọc")).toBeNull());
  });
});
