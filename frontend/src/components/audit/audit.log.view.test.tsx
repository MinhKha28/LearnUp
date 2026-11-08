// @vitest-environment jsdom
import { App } from "antd";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchAuditLogsAPI } from "@/services/audit.service";
import type { IAuditLog, IAuditLogPage } from "@/types/audit.types";
import AuditLogView from "./audit.log.view";

vi.mock("@/services/audit.service", () => ({ fetchAuditLogsAPI: vi.fn() }));

const fetchLogs = vi.mocked(fetchAuditLogsAPI);

const log = (over: Partial<IAuditLog> = {}): IAuditLog => ({
  id: crypto.randomUUID(),
  organizationId: "0199a000-0000-7000-8000-0a0000000001",
  actorUserId: "0199a000-0000-7000-8000-0b00000000aa",
  actorRole: "ORGANIZER",
  actionType: "INSTRUCTOR_DEACTIVATED",
  targetResourceType: "User",
  targetResourceId: "0199a000-0000-7000-8000-0c00000000bb",
  details: JSON.stringify({ reason: "Vi phạm nội quy", occurredAt: "2026-11-02T03:04:00.000Z" }),
  createdAt: "2026-11-02T03:04:30.000Z",
  ...over,
});

const answer = (items: IAuditLog[], over: Partial<IAuditLogPage> = {}) =>
  ({
    success: true,
    data: { items, page: 0, size: 20, totalElements: items.length, totalPages: items.length ? 1 : 0, first: true, last: true, ...over },
  }) as never;

const renderView = (url = "/", showOrganization = false) => {
  const router = createMemoryRouter([{ path: "/", element: <App><AuditLogView showOrganization={showOrganization} /></App> }], {
    initialEntries: [url],
    future: { v7_relativeSplatPath: true },
  });
  render(<RouterProvider router={router} future={{ v7_startTransition: true }} />);
  return router;
};
const search = (router: ReturnType<typeof renderView>) => new URLSearchParams(router.state.location.search);
/** Types a day in the date field the way a person does (dd/mm/yyyy) and confirms it with Enter. */
const pickDay = (label: string, value: string) => {
  const field = screen.getByLabelText(label);
  fireEvent.change(field, { target: { value } });
  fireEvent.keyDown(field, { key: "Enter", keyCode: 13 });
};
const lastQuery = () => fetchLogs.mock.calls[fetchLogs.mock.calls.length - 1][0];

beforeEach(() => {
  fetchLogs.mockReset();
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("UC50, UC51 list of the audit trail", () => {
  it("shows who, what, on what, when and why, in Vietnamese and Vietnam time", async () => {
    fetchLogs.mockResolvedValue(answer([log()]));
    renderView();
    await screen.findByText("Ngừng hoạt động tài khoản giảng viên");
    const row = screen.getByText("Ngừng hoạt động tài khoản giảng viên").closest("tr")!;
    expect(within(row).getByText("02/11/2026 10:04")).toBeTruthy(); // 03:04Z is 10:04 in Vietnam: the time of the action, not of the arrival
    expect(within(row).getByText(/Quản trị viên tổ chức/)).toBeTruthy();
    expect(within(row).getByText(/Tài khoản/)).toBeTruthy();
    expect(within(row).getByText(/…000000bb/)).toBeTruthy();
    expect(within(row).getByText("Vi phạm nội quy")).toBeTruthy();
    for (const heading of ["Thời điểm", "Người thực hiện", "Hành động", "Đối tượng tác động", "Lý do"]) {
      expect(screen.getByText(heading)).toBeTruthy();
    }
    expect(screen.queryByText("Tổ chức")).toBeNull(); // the Organizer reads one Organization: no such column
  });

  it("shows a dash when there is no reason and falls back to the arrival time and to the raw code of an unknown action", async () => {
    fetchLogs.mockResolvedValue(answer([log({ details: null, actionType: "SOMETHING_NEW", actorRole: null, actorUserId: null, targetResourceType: "Gadget" })]));
    renderView();
    await screen.findByText(/SOMETHING_NEW/);
    const row = screen.getByText(/SOMETHING_NEW/).closest("tr")!;
    expect(within(row).getByText(/(Gadget)/)).toBeTruthy(); // the same for a type of target the screen has no word for
    expect(within(row).getByText("Đối tượng khác", { exact: false })).toBeTruthy();
    expect(within(row).getByText("Hành động khác")).toBeTruthy(); // a code with no word is called "other" and the code is written next to it
    expect(within(row).getByText("02/11/2026 10:04")).toBeTruthy();
    expect(within(row).getByText("Hệ thống")).toBeTruthy();
    expect(within(row).getAllByText("—").length).toBeGreaterThan(0);
  });

  it("UC51: the Admin also sees the Organization of each action, and the platform actions say so", async () => {
    fetchLogs.mockResolvedValue(answer([log(), log({ organizationId: null, actionType: "PLAN_DISCONTINUED", targetResourceType: "Plan" })]));
    renderView("/", true);
    await screen.findByText("Ngừng cung cấp gói dịch vụ");
    expect(screen.getByText("Tổ chức")).toBeTruthy();
    expect(screen.getByText("Cấp nền tảng")).toBeTruthy();
    expect(screen.getByText("…00000001")).toBeTruthy();
  });

  it("asks for the first page with no filter, and the empty answer says that nothing was recorded", async () => {
    fetchLogs.mockResolvedValue(answer([]));
    renderView();
    await screen.findByText("Chưa có hành động nào được ghi nhận.");
    expect(lastQuery()).toEqual({ page: 1, targetResourceType: undefined, targetResourceId: undefined, from: undefined, to: undefined });
  });

  it("applies the filter, puts it in the URL, goes back to page 1 and keeps the other filters off the request when blank", async () => {
    fetchLogs.mockResolvedValue(answer([log()]));
    const router = renderView("/?page=3");
    await screen.findByText("Ngừng hoạt động tài khoản giảng viên");
    fireEvent.change(screen.getByLabelText("Mã đối tượng"), { target: { value: "  abc-123 " } });
    pickDay("Từ ngày", "01/11/2026");
    pickDay("Đến ngày", "08/11/2026");
    fireEvent.click(screen.getByRole("button", { name: "Lọc" }));
    await waitFor(() => expect(lastQuery()).toEqual({
      page: 1, targetResourceType: undefined, targetResourceId: "abc-123", from: "2026-11-01", to: "2026-11-08",
    }));
    expect(search(router).get("target")).toBe("abc-123");
    expect(search(router).get("from")).toBe("2026-11-01");
    expect(search(router).get("to")).toBe("2026-11-08");
    expect(search(router).get("page")).toBeNull();
  });

  it("the target type takes a suggestion or any typed value", async () => {
    fetchLogs.mockResolvedValue(answer([log()]));
    const router = renderView();
    await screen.findByText("Ngừng hoạt động tài khoản giảng viên");
    fireEvent.change(screen.getByRole("combobox", { name: /Loại đối tượng/ }), { target: { value: "Course" } });
    fireEvent.click(screen.getByRole("button", { name: "Lọc" }));
    await waitFor(() => expect(lastQuery().targetResourceType).toBe("Course"));
    expect(search(router).get("type")).toBe("Course");
  });

  it("restores the filter and the page from the URL, and the form shows them", async () => {
    fetchLogs.mockResolvedValue(answer([log()], { page: 1, totalElements: 41, totalPages: 3, first: false }));
    renderView("/?type=User&target=abc&from=2026-11-01&to=2026-11-08&page=2");
    await screen.findByText("Ngừng hoạt động tài khoản giảng viên");
    expect(lastQuery()).toEqual({ page: 2, targetResourceType: "User", targetResourceId: "abc", from: "2026-11-01", to: "2026-11-08" });
    expect((screen.getByLabelText("Mã đối tượng") as HTMLInputElement).value).toBe("abc");
    expect((screen.getByLabelText("Từ ngày") as HTMLInputElement).value).toBe("01/11/2026"); // dd/mm/yyyy, whatever the language of the browser
    expect((screen.getByLabelText("Đến ngày") as HTMLInputElement).value).toBe("08/11/2026");
  });

  it("ignores a bad day or a blank text in the URL instead of sending it", async () => {
    fetchLogs.mockResolvedValue(answer([log()]));
    renderView("/?from=2026-02-30&to=abc&target=%20&type=&page=-4");
    await screen.findByText("Ngừng hoạt động tài khoản giảng viên");
    expect(lastQuery()).toEqual({ page: 1, targetResourceType: undefined, targetResourceId: undefined, from: undefined, to: undefined });
  });

  it("a reversed range is refused in the form and never asked of the server", async () => {
    fetchLogs.mockResolvedValue(answer([log()]));
    renderView();
    await screen.findByText("Ngừng hoạt động tài khoản giảng viên");
    const calls = fetchLogs.mock.calls.length;
    pickDay("Từ ngày", "08/11/2026");
    pickDay("Đến ngày", "01/11/2026");
    fireEvent.click(screen.getByRole("button", { name: "Lọc" }));
    await screen.findByText("Ngày bắt đầu phải trước hoặc cùng ngày với ngày kết thúc.");
    expect(fetchLogs.mock.calls.length).toBe(calls);
  });

  it("a reversed range that arrives in a link is explained and not asked of the server either", async () => {
    renderView("/?from=2026-11-08&to=2026-11-01");
    await screen.findByText("Ngày bắt đầu phải trước hoặc cùng ngày với ngày kết thúc.");
    expect(fetchLogs).not.toHaveBeenCalled();
  });

  it("one day (from equal to to) is a valid range", async () => {
    fetchLogs.mockResolvedValue(answer([log()]));
    renderView("/?from=2026-11-08&to=2026-11-08");
    await screen.findByText("Ngừng hoạt động tài khoản giảng viên");
    expect(lastQuery().from).toBe("2026-11-08");
    expect(lastQuery().to).toBe("2026-11-08");
  });

  it("a filtered list with no result says so, and clearing the filter asks again without it", async () => {
    fetchLogs.mockImplementation(async (query) => (query.targetResourceId ? answer([]) : answer([log()])));
    const router = renderView("/?target=zzz");
    await screen.findByText("Không có bản ghi nào phù hợp với bộ lọc.");
    fireEvent.click(screen.getByRole("button", { name: "Xóa bộ lọc" }));
    await screen.findByText("Ngừng hoạt động tài khoản giảng viên");
    expect(lastQuery().targetResourceId).toBeUndefined();
    expect(router.state.location.search).toBe("");
    expect((screen.getByLabelText("Mã đối tượng") as HTMLInputElement).value).toBe("");
  });

  it("changes the page through the URL and asks for it", async () => {
    fetchLogs.mockResolvedValue(answer([log()], { totalElements: 45, totalPages: 3 }));
    const router = renderView("/?target=abc");
    await screen.findByText("Ngừng hoạt động tài khoản giảng viên");
    fireEvent.click(screen.getByTitle("2"));
    await waitFor(() => expect(lastQuery().page).toBe(2));
    expect(search(router).get("page")).toBe("2");
    expect(search(router).get("target")).toBe("abc");
  });

  it("a page past the end goes to the last page", async () => {
    fetchLogs.mockImplementation(async (query) =>
      query.page > 2 ? answer([], { page: query.page - 1, totalElements: 30, totalPages: 2 }) : answer([log()], { totalElements: 30, totalPages: 2 }));
    const router = renderView("/?page=9");
    await waitFor(() => expect(search(router).get("page")).toBe("2"));
    await screen.findByText("Ngừng hoạt động tài khoản giảng viên");
  });

  it("an error shows a message and a retry that asks again with the same filter", async () => {
    fetchLogs.mockRejectedValueOnce(new Error("network"));
    renderView("/?target=abc");
    await screen.findByText("Không tải được nhật ký. Vui lòng thử lại.");
    fetchLogs.mockResolvedValue(answer([log()]));
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await screen.findByText("Ngừng hoạt động tài khoản giảng viên");
    expect(lastQuery().targetResourceId).toBe("abc");
  });

  it("an answer that is an HTTP error (it arrives as the body) shows the message, and 403 says that the caller may not read", async () => {
    fetchLogs.mockResolvedValue({ success: false, error: { code: "FORBIDDEN", message: "x" } } as never);
    renderView();
    await screen.findByText("Bạn không có quyền xem nhật ký.");
    cleanup();
    fetchLogs.mockResolvedValue({ success: false, error: { code: "INTERNAL", message: "x" } } as never);
    renderView();
    await screen.findByText("Không tải được nhật ký. Vui lòng thử lại.");
  });

  it("an older answer never replaces a newer one", async () => {
    const resolvers: ((value: unknown) => void)[] = [];
    fetchLogs.mockImplementation(() => new Promise((resolve) => { resolvers.push(resolve); }) as never);
    renderView();
    await waitFor(() => expect(resolvers.length).toBe(1));
    fireEvent.change(screen.getByLabelText("Mã đối tượng"), { target: { value: "new" } });
    fireEvent.click(screen.getByRole("button", { name: "Lọc" }));
    await waitFor(() => expect(resolvers.length).toBe(2));
    resolvers[1](answer([log({ actionType: "INSTRUCTOR_REACTIVATED" })]));
    await screen.findByText("Kích hoạt lại tài khoản giảng viên");
    resolvers[0](answer([log({ actionType: "INSTRUCTOR_DEACTIVATED" })]));
    await new Promise((done) => setTimeout(done, 30));
    expect(screen.queryByText("Ngừng hoạt động tài khoản giảng viên")).toBeNull();
    expect(screen.getByText("Kích hoạt lại tài khoản giảng viên")).toBeTruthy();
  });

  it("has no export and no before/after comparison (BR-338)", async () => {
    fetchLogs.mockResolvedValue(answer([log()]));
    renderView();
    await screen.findByText("Ngừng hoạt động tài khoản giảng viên");
    expect(screen.queryByRole("button", { name: /xuất|tải|export|csv/i })).toBeNull();
  });
});
