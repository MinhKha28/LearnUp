// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it } from "vitest";
import ReportContent from "./report.content";

afterEach(cleanup);

it("starts a reading report with the resource title and its Vietnamese type", () => {
  render(
    <MemoryRouter initialEntries={["/learner/courses/workplace-safety/lessons/m1-l1/resources/m1-l1-reading/report"]}>
      <Routes>
        <Route path="/learner/courses/:enrollmentId/lessons/:lessonId/resources/:resourceId/report" element={<ReportContent />} />
      </Routes>
    </MemoryRouter>,
  );
  expect(screen.getByDisplayValue("Sổ tay khóa học")).toBeTruthy();
  expect(screen.getByText("Tài liệu đọc")).toBeTruthy();
});
