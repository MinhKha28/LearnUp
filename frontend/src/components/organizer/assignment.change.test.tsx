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
  fetchAssignment: vi.fn(), fetchAssignments: vi.fn(),
  extendAssignment: vi.fn(), exemptAssignment: vi.fn(),
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

const detail: AssignmentDetail = {
  enrollmentId: "enrollment", learner: null, course: null, assignedAt: null,
  dueAt: "2026-10-29T17:00:00Z", dueTimezone: "Asia/Ho_Chi_Minh",
  organizationTimezone: "Asia/Ho_Chi_Minh", status: "NotStarted",
  requiredCompleted: 0, requiredTotal: 1, baseDueAt: "2026-10-29T17:00:00Z",
  extensionSeconds: 0, firstActivityAt: null, completedAt: null, completedLate: null,
  withdrawnAt: null, withdrawnReason: null, intervals: [],
};
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
});
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
