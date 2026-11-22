// @vitest-environment jsdom-native
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
vi.mock("@/services/learning.service", () => ({ fetchEnrolledCourseLinks: vi.fn() }));
import { fetchEnrolledCourseLinks } from "@/services/learning.service";
import CourseResultsResolver from "./course.results.resolver";
const load = vi.mocked(fetchEnrolledCourseLinks);
beforeAll(() => Object.defineProperty(window, "matchMedia", { writable: true, value: () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }) }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const Location = () => <p>{useLocation().pathname}</p>;
const show = () => render(<MemoryRouter initialEntries={["/learner/courses/by-course/course/results"]}><Routes>
<Route path="/learner/courses/by-course/:courseId/results" element={<CourseResultsResolver />} />
<Route path="*" element={<Location />} /></Routes></MemoryRouter>);
it.each(["InProgress", "Completed", "Exempted", "Halted"])("resolves %s", async (status) => {
 load.mockResolvedValue([{courseId:"course", enrollmentId:"enrollment", status}] as never); show();
 expect(await screen.findByText("/learner/courses/enrollment/results")).toBeTruthy();
});
it("shows not found for an absent enrollment", async () => {
 load.mockResolvedValue([]); show(); expect(await screen.findByText("Không tìm thấy khóa học")).toBeTruthy();
 fireEvent.click(screen.getByText("Về khóa học của tôi")); expect(await screen.findByText("/learner/courses")).toBeTruthy();
});
it("shows loading and aborts on unmount", () => {
 load.mockImplementation(() => new Promise(() => {})); const view = show(); expect(screen.getByRole("status")).toBeTruthy();
 const signal = load.mock.calls[0][0]; view.unmount(); expect(signal?.aborted).toBe(true);
});
it("offers retry after an API error", async () => {
 load.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce([]); show();
 expect(await screen.findByRole("heading", { name: "Không tải được thông tin khóa học" })).toBeTruthy();
 expect(screen.getByText("Vui lòng thử lại.")).toBeTruthy();
 fireEvent.click(await screen.findByText("Thử lại")); expect(await screen.findByText("Không tìm thấy khóa học")).toBeTruthy();
});
