// @vitest-environment jsdom
// UC49: the bell and the page of the notifications, in Vietnamese (BR-232: the notice of the reviews handed out is one of them).
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
  title: "Bạn có bài cần chấm chéo",
  message: "Bạn có 2 bài nộp cần chấm cho bài tập «Kế hoạch». Vui lòng hoàn thành trước 08/11/2026 06:31.",
  type: "PEER_REVIEW",
  channel: "IN_APP",
  isRead: false,
  readAt: null,
  metadata: null,
  createdAt: "2026-11-05T01:33:02Z",
  ...over,
});

const page = (items: unknown[], totalElements = items.length) => ({
  items,
  page: 0,
  size: 10,
  totalElements,
  totalPages: 1,
  first: true,
  last: true,
});

beforeAll(() => {
  // antd reads matchMedia; jsdom has none
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
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const renderBell = () =>
  render(
    <MemoryRouter>
      <NotificationBell basePath="/learner" />
    </MemoryRouter>,
  );

describe("the bell", () => {
  it("is named in Vietnamese and opens a drop-down in Vietnamese with the notice, its time as day/month/year", async () => {
    renderBell();
    fireEvent.click(await screen.findByRole("button", { name: "Thông báo" }));

    await screen.findByText("Bạn có bài cần chấm chéo");
    expect(screen.getByText("Thông báo")).toBeTruthy();
    expect(screen.getByText("1 chưa đọc")).toBeTruthy();
    expect(screen.getByText("Xem tất cả thông báo")).toBeTruthy();
    expect(screen.getByLabelText("Chưa đọc")).toBeTruthy();
    // 05/11/2026 08:33 in the Vietnamese order (day first, as on every other page), never the American 11/5/2026
    expect(screen.getByText("05/11/2026 08:33")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Notifications|unread|View all|Loading|AM|PM/);
  });

  it("says in Vietnamese when there is nothing, and when the list cannot be loaded", async () => {
    vi.mocked(api.fetchNotifications).mockResolvedValueOnce(page([]) as never);
    renderBell();
    fireEvent.click(await screen.findByRole("button", { name: "Thông báo" }));
    await screen.findByText("Bạn chưa có thông báo nào.");
    cleanup();

    vi.mocked(api.fetchNotifications).mockRejectedValueOnce(new Error("network"));
    renderBell();
    fireEvent.click(await screen.findByRole("button", { name: "Thông báo" }));
    await screen.findByText("Không tải được thông báo. Hãy thử lại sau.");
  });
});

describe("the page", () => {
  it("is in Vietnamese: the title, the filter, the count and the notice", async () => {
    render(<NotificationPage />);
    await screen.findByText("Bạn có bài cần chấm chéo");
    expect(screen.getByRole("heading", { name: "Thông báo" })).toBeTruthy();
    expect(screen.getByText("Tất cả")).toBeTruthy();
    expect(screen.getAllByText("Chưa đọc").length).toBeGreaterThan(0);
    expect(screen.getByText("1 chưa đọc")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Notifications|Unread|All\b|Updates about/);
  });

  it("says in Vietnamese when there is nothing, with the way back to the whole list from the unread filter", async () => {
    vi.mocked(api.fetchNotifications).mockResolvedValue(page([]) as never);
    render(<NotificationPage />);
    await screen.findByText("Chưa có thông báo nào");
    expect(screen.getByText("Khi có việc cần bạn chú ý, thông báo sẽ hiện ở đây.")).toBeTruthy();

    fireEvent.click(screen.getByText("Chưa đọc"));
    await screen.findByText("Bạn đã xem hết thông báo");
    expect(screen.getByText("Bạn không có thông báo chưa đọc.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Xem tất cả thông báo" }));
    await waitFor(() => expect(screen.getByText("Chưa có thông báo nào")).toBeTruthy());
  });

  it("says in Vietnamese when it cannot load, and tries again on the button", async () => {
    vi.mocked(api.fetchNotifications).mockRejectedValueOnce(new Error("network"));
    render(<NotificationPage />);
    await screen.findByText("Không tải được thông báo");
    expect(screen.getByText("Đã có lỗi xảy ra. Vui lòng thử lại.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await screen.findByText("Bạn có bài cần chấm chéo");
  });
});
