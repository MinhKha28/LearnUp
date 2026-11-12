// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import Reports from "./reports";

vi.mock("@/components/learner/learner.data", () => ({
  contentReports: ["Lesson", "Video", "Reading", "Quiz", "Assignment"].map((contentType) => ({
    id: contentType,
    reportedItem: `Nội dung ${contentType}`,
    contentType,
    courseTitle: "An toàn lao động",
    submittedDate: "25/09/2026",
    status: "pending",
    reason: "Cần cập nhật nội dung.",
  })),
}));

beforeAll(() => {
  window.matchMedia ??= (() => ({
    matches: false,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as never;
});
afterEach(cleanup);

it.each([
  ["Lesson", "Bài học"],
  ["Video", "Video"],
  ["Reading", "Tài liệu đọc"],
  ["Quiz", "Bài trắc nghiệm"],
  ["Assignment", "Bài tập"],
])("shows the Vietnamese content type for %s in the details modal", async (value, label) => {
  render(<MemoryRouter><Reports /></MemoryRouter>);
  const row = screen.getByRole("row", { name: new RegExp(`Nội dung ${value}`) });
  fireEvent.click(within(row).getByRole("button", { name: "Xem báo cáo" }));
  const modal = await screen.findByRole("dialog", { name: "Chi tiết báo cáo" });
  expect(within(modal).getByText(label, { selector: "strong" })).toBeTruthy();
});
