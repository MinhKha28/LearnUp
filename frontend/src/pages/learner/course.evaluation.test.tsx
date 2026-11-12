// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it } from "vitest";
import CourseEvaluation from "./course.evaluation";

afterEach(cleanup);

it("requires a 1–5 rating in all three groups and allows an empty comment", async () => {
  render(
    <MemoryRouter initialEntries={["/learner/courses/operational-procedures/evaluation"]}>
      <Routes>
        <Route path="/learner/courses/:enrollmentId/evaluation" element={<CourseEvaluation />} />
      </Routes>
    </MemoryRouter>,
  );
  const groups = screen.getAllByRole("group");
  expect(groups).toHaveLength(3);
  for (const group of groups) {
    expect(within(group).getAllByRole("button").map((button) => button.getAttribute("aria-label")))
      .toEqual(["1 sao", "2 sao", "3 sao", "4 sao", "5 sao"]);
  }
  expect(screen.getByRole("textbox").getAttribute("maxlength")).toBe("2000");
  const submit = screen.getByRole("button", { name: "Gửi đánh giá" });
  fireEvent.click(within(groups[0]).getByRole("button", { name: "1 sao" }));
  fireEvent.click(within(groups[1]).getByRole("button", { name: "3 sao" }));
  fireEvent.click(submit);
  expect(screen.queryByRole("heading", { name: "Sửa đánh giá khóa học" })).toBeNull();
  fireEvent.click(within(groups[2]).getByRole("button", { name: "5 sao" }));
  fireEvent.click(submit);
  await screen.findByRole("heading", { name: "Sửa đánh giá khóa học" });
  // Both forms cap the optional comment at 2000 characters; the input itself enforces it.
  expect(screen.getByRole("textbox").getAttribute("maxlength")).toBe("2000");
  expect(screen.getAllByRole("button", { pressed: true }).map((button) => button.getAttribute("aria-label")))
    .toEqual(["1 sao", "3 sao", "5 sao"]);
});
