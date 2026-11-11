// @vitest-environment jsdom
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { AssignmentChange } from "./assignment.change";
import type { AssignmentDetail } from "@/types/assignment.types";
import * as views from "@/utils/assignments.view";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AssignmentDetailPage from "@/pages/organizer/assignment.detail";
import { ApiError } from "@/types/api.types";
import * as api from "@/services/assignment.service";

vi.mock("@/services/assignment.service", () => ({
  fetchAssignment: vi.fn(), fetchAssignments: vi.fn(), cancelAssignment: vi.fn(),
  extendAssignment: vi.fn(), exemptAssignment: vi.fn(), removeAssignmentExemption: vi.fn(),
}));
beforeAll(() => {
  const computedStyle = window.getComputedStyle.bind(window);
  window.getComputedStyle = (element) => computedStyle(element);
  window.matchMedia = (query: string) => ({ matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it("UC24.3 passes the live organization zone to the picker range despite a changed organization zone", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-29T12:00:00Z"));
  const range = vi.spyOn(views, "assignmentExtensionRange");
  const item: AssignmentDetail & { organizationTimezone: string } = {
    enrollmentId: "enrollment", learner: null, course: null, assignedAt: null,
    dueAt: "2026-10-29T17:00:00Z", dueTimezone: "Asia/Ho_Chi_Minh",
    organizationTimezone: "Pacific/Auckland", status: "NotStarted",
    requiredCompleted: 0, requiredTotal: 1, baseDueAt: "2026-10-29T17:00:00Z",
    extensionSeconds: 0, firstActivityAt: null, completedAt: null, completedLate: null,
    withdrawnAt: null, withdrawnReason: null, intervals: [],
  };
  render(<AssignmentChange item={item} onChanged={() => undefined} onConflict={() => undefined} onReload={() => undefined} />);
  expect(range).toHaveBeenCalledWith(item.dueAt, item.organizationTimezone);
  expect(range.mock.results[0].value).toEqual({ min: "2026-10-30" });
});

const showDetail = () => render(
  <MemoryRouter initialEntries={["/organizer/assignments/enrollment"]}>
    <Routes>
      <Route path="/organizer/assignments/:assignmentId" element={<AssignmentDetailPage />} />
    </Routes>
  </MemoryRouter>,
);

it("UC24.6 requires confirmation and shows the returned status", async () => {
  vi.mocked(api.fetchAssignment).mockResolvedValue({ ...detail, status: "Exempted" });
  vi.mocked(api.fetchAssignments).mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 });
  let finish!: (value: AssignmentDetail) => void;
  vi.mocked(api.removeAssignmentExemption).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  showDetail();

  const action = await screen.findByRole("button", { name: "Gỡ Miễn" });
  fireEvent.click(action);
  const initialDialog = await screen.findByRole("dialog", { name: "Gỡ Miễn" });
  expect(within(initialDialog).queryByRole("textbox")).toBeNull();
  fireEvent.click(within(initialDialog).getByRole("button", { name: "Hủy" }));
  expect(api.removeAssignmentExemption).not.toHaveBeenCalled();

  fireEvent.click(action);
  const dialog = await screen.findByRole("dialog", { name: "Gỡ Miễn" });
  const confirm = within(dialog).getByRole("button", { name: "Gỡ Miễn" });
  fireEvent.click(confirm);
  expect((action as HTMLButtonElement).disabled).toBe(true);
  expect((confirm as HTMLButtonElement).disabled).toBe(true);
  expect(api.removeAssignmentExemption).toHaveBeenCalledTimes(1);
  expect(api.removeAssignmentExemption).toHaveBeenCalledWith("enrollment");
  finish({ ...detail, status: "InProgress" });
  expect(await screen.findByText("Đang học")).toBeTruthy();
  await waitFor(() => expect(screen.queryByRole("button", { name: "Gỡ Miễn" })).toBeNull());
});

it("UC24.6 reloads detail on 409 and hides the action when the status changed", async () => {
  vi.mocked(api.fetchAssignment)
    .mockResolvedValueOnce({ ...detail, status: "Exempted" })
    .mockResolvedValue({ ...detail, status: "Halted" });
  vi.mocked(api.removeAssignmentExemption).mockRejectedValue(new ApiError(409, "ENROLLMENT_NOT_EXEMPTED", ""));
  showDetail();

  fireEvent.click(await screen.findByRole("button", { name: "Gỡ Miễn" }));
  const dialog = await screen.findByRole("dialog", { name: "Gỡ Miễn" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Gỡ Miễn" }));
  expect(await screen.findByText("Tạm dừng")).toBeTruthy();
  expect(screen.getByText("Phân công không còn ở trạng thái Miễn. Đang tải lại chi tiết.")).toBeTruthy();
  expect(api.fetchAssignment).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole("button", { name: "Gỡ Miễn" })).toBeNull();
});

const detail: AssignmentDetail = {
  enrollmentId: "enrollment", learner: null, course: null, assignedAt: null,
  dueAt: "2026-10-29T17:00:00Z", dueTimezone: "Asia/Ho_Chi_Minh",
  organizationTimezone: "Asia/Ho_Chi_Minh", status: "NotStarted",
  requiredCompleted: 0, requiredTotal: 1, baseDueAt: "2026-10-29T17:00:00Z",
  extensionSeconds: 0, firstActivityAt: null, completedAt: null, completedLate: null,
  withdrawnAt: null, withdrawnReason: null, intervals: [],
};
it("UC24.4 confirms, submits once, and reloads the withdrawn detail", async () => {
  const withdrawn = { ...detail, status: "Withdrawn", withdrawnReason: "OrganizerCancelled" } as const;
  vi.mocked(api.fetchAssignment).mockResolvedValueOnce(detail).mockResolvedValue(withdrawn);
  vi.mocked(api.fetchAssignments).mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 });
  let finish!: (value: AssignmentDetail) => void;
  vi.mocked(api.cancelAssignment).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  showDetail();
  const action = await screen.findByRole("button", { name: "Hủy phân công" });
  fireEvent.click(action);
  let modal = await screen.findByRole("dialog");
  expect(within(modal).getByText(/có thể được phân công lại sau/)).toBeTruthy();
  fireEvent.click(within(modal).getByRole("button", { name: "Quay lại" }));
  expect(api.cancelAssignment).not.toHaveBeenCalled();
  fireEvent.click(action);
  modal = await screen.findByRole("dialog");
  const confirm = within(modal).getByRole("button", { name: "Hủy phân công" });
  fireEvent.click(confirm);
  fireEvent.click(confirm);
  expect(api.cancelAssignment).toHaveBeenCalledTimes(1);
  finish(withdrawn);
  expect(await screen.findByText("Đã rút")).toBeTruthy();
  await waitFor(() => expect(api.fetchAssignment).toHaveBeenCalledTimes(2));
});

it.each(["ENROLLMENT_NOT_CANCELLABLE", "ASSIGNMENT_HAS_LEARNING_DATA"])("UC24.4 reloads detail on %s", async (code) => {
  vi.mocked(api.fetchAssignment).mockResolvedValueOnce(detail).mockResolvedValue({ ...detail, status: "InProgress", firstActivityAt: detail.dueAt });
  vi.mocked(api.cancelAssignment).mockRejectedValue(new ApiError(409, code, ""));
  showDetail();
  fireEvent.click(await screen.findByRole("button", { name: "Hủy phân công" }));
  const modal = await screen.findByRole("dialog");
  fireEvent.click(within(modal).getByRole("button", { name: "Hủy phân công" }));
  expect(await screen.findByText(views.assignmentErrorMessage(code))).toBeTruthy();
  expect(await screen.findByText("Đang học")).toBeTruthy();
  expect(api.fetchAssignment).toHaveBeenCalledTimes(2);
});

it("UC24.4 offers cancellation for untouched Overdue and retains confirmation on 503", async () => {
  vi.mocked(api.fetchAssignment).mockResolvedValue({ ...detail, status: "Overdue" });
  vi.mocked(api.cancelAssignment).mockRejectedValue(new ApiError(503, "SERVICE_UNAVAILABLE", ""));
  showDetail();
  fireEvent.click(await screen.findByRole("button", { name: "Hủy phân công" }));
  const modal = await screen.findByRole("dialog");
  fireEvent.click(within(modal).getByRole("button", { name: "Hủy phân công" }));
  expect(await within(modal).findByText(views.assignmentErrorMessage("SERVICE_UNAVAILABLE"))).toBeTruthy();
  expect(api.fetchAssignment).toHaveBeenCalledTimes(1);
});

it.each(["DUE_DATE_IN_PAST", "DUE_DATE_NOT_LATER"])("%s keeps the inline error while reloading detail and its picker zone", async (code) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-29T12:00:00Z"));
  vi.mocked(api.fetchAssignment).mockResolvedValueOnce(detail).mockResolvedValue({ ...detail, organizationTimezone: "Pacific/Auckland" });
  vi.mocked(api.extendAssignment).mockRejectedValue(new ApiError(422, code, "server error"));
  render(<MemoryRouter initialEntries={["/organizer/assignments/enrollment"]}><Routes><Route path="/organizer/assignments/:assignmentId" element={<AssignmentDetailPage />} /></Routes></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "Kéo dài hạn" }));
  const modal = await screen.findByRole("dialog");
  expect(within(modal).queryByText(/Hạn mới được tính theo/)).toBeNull();
  const input = within(modal).getByPlaceholderText("Chọn ngày");
  fireEvent.change(input, { target: { value: "31/10/2026" } });
  fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
  fireEvent.blur(input);
  fireEvent.click(within(modal).getByRole("button", { name: "Kéo dài hạn" }));
  await waitFor(() => expect(api.extendAssignment).toHaveBeenCalledWith("enrollment", "2026-10-31", ""));
  await waitFor(() => expect(api.fetchAssignment).toHaveBeenCalledTimes(2));
  expect(await within(modal).findByText(views.assignmentErrorMessage(code))).toBeTruthy();
  expect(await within(modal).findByText("Hạn mới được tính theo múi giờ hiện tại của tổ chức: giờ New Zealand (GMT+13)")).toBeTruthy();
  expect((input as HTMLInputElement).value).toBe("31/10/2026");
}, 10_000);
it.each([null, "Asia/Ho_Chi_Minh"])("omits the changed-zone label for %s", async (organizationTimezone) => {
  render(<AssignmentChange item={{ ...detail, organizationTimezone }} onChanged={() => undefined} onConflict={() => undefined} onReload={() => undefined} />);
  fireEvent.click(screen.getByRole("button", { name: "Kéo dài hạn" }));
  const modal = await screen.findByRole("dialog");
  expect(within(modal).queryByText(/Hạn mới được tính theo/)).toBeNull();
});
it("falls back from missing organization zone to stored zone, then device zone", () => {
  const range = vi.spyOn(views, "assignmentExtensionRange");
  for (const dueTimezone of ["Asia/Ho_Chi_Minh", null]) {
    render(<AssignmentChange item={{ ...detail, organizationTimezone: null, dueTimezone }} onChanged={() => undefined} onConflict={() => undefined} onReload={() => undefined} />);
    expect(range).toHaveBeenLastCalledWith(detail.dueAt, dueTimezone);
    cleanup();
  }
});

it("shows each deadline's readable zone and updates the selected deadline offset across DST", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-29T12:00:00Z"));
  render(<AssignmentChange item={{ ...detail, organizationTimezone: "America/New_York" }} onChanged={() => undefined} onConflict={() => undefined} onReload={() => undefined} />);
  fireEvent.click(screen.getByRole("button", { name: "Kéo dài hạn" }));
  const modal = await screen.findByRole("dialog");
  expect(within(modal).getByText("Hạn mới được tính theo múi giờ hiện tại của tổ chức: giờ miền Đông (GMT-4)")).toBeTruthy();
  const input = within(modal).getByPlaceholderText("Chọn ngày");
  fireEvent.change(input, { target: { value: "01/11/2026" } });
  fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
  fireEvent.blur(input);
  await waitFor(() => expect(within(modal).getByText("Hạn hiện tại: 29/10/2026 (giờ Đông Dương (GMT+7)) → Hạn mới: 01/11/2026 (giờ miền Đông (GMT-5))")).toBeTruthy());
  expect(within(modal).getByText("Hạn mới được tính theo múi giờ hiện tại của tổ chức: giờ miền Đông (GMT-5)")).toBeTruthy();
  expect(modal.textContent).not.toMatch(/America\/|Asia\//);
});
it.each([
  ["Asia/Ho_Chi_Minh", "Asia/Ho_Chi_Minh", "29/10/2026"],
  [null, "Asia/Ho_Chi_Minh", "29/10/2026"],
  ["America/New_York", null, "30/10/2026"],
])("preserves the plain summary when either zone is null or zones agree (%s, %s)", async (organizationTimezone, dueTimezone, currentDate) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-29T12:00:00Z"));
  render(<AssignmentChange item={{ ...detail, organizationTimezone, dueTimezone }} onChanged={() => undefined} onConflict={() => undefined} onReload={() => undefined} />);
  fireEvent.click(screen.getByRole("button", { name: "Kéo dài hạn" }));
  const modal = await screen.findByRole("dialog");
  expect(within(modal).getByText(`Hạn hiện tại: ${currentDate} → Hạn mới: Chưa chọn`)).toBeTruthy();
});

it.each(["Asia/Ho_Chi_Minh", "Asia/Saigon"])("%s matches the stored default zone without a changed-zone label or two-zone summary", async organizationTimezone => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-29T12:00:00Z"));
  render(<AssignmentChange item={{ ...detail, organizationTimezone }} onChanged={() => undefined} onConflict={() => undefined} onReload={() => undefined} />);
  fireEvent.click(screen.getByRole("button", { name: "Kéo dài hạn" }));
  const modal = await screen.findByRole("dialog");
  expect(within(modal).queryByText(/Hạn mới được tính theo/)).toBeNull();
  expect(within(modal).getByText("Hạn hiện tại: 29/10/2026 → Hạn mới: Chưa chọn")).toBeTruthy();
});
it("Ho Chi Minh versus Auckland shows the changed-zone label and both deadline zones", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-29T12:00:00Z"));
  render(<AssignmentChange item={{ ...detail, organizationTimezone: "Pacific/Auckland" }} onChanged={() => undefined} onConflict={() => undefined} onReload={() => undefined} />);
  fireEvent.click(screen.getByRole("button", { name: "Kéo dài hạn" }));
  const modal = await screen.findByRole("dialog");
  const input = within(modal).getByPlaceholderText("Chọn ngày");
  fireEvent.change(input, { target: { value: "30/10/2026" } });
  fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
  fireEvent.blur(input);
  await waitFor(() => expect(within(modal).getByText("Hạn hiện tại: 29/10/2026 (giờ Đông Dương (GMT+7)) → Hạn mới: 30/10/2026 (giờ New Zealand (GMT+13))")).toBeTruthy());
  expect(within(modal).getByText("Hạn mới được tính theo múi giờ hiện tại của tổ chức: giờ New Zealand (GMT+13)")).toBeTruthy();
});
