// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { PageHeader as AdminHeader } from "./admin/admin.ui";
import { PageHeader as InstructorHeader } from "./instructor/instructor.ui";
import { PageHeader as OrganizerHeader } from "./organizer/organizer.ui";

afterEach(cleanup);

describe.each([
  ["admin", AdminHeader],
  ["instructor", InstructorHeader],
  ["organizer", OrganizerHeader],
])("the page header of the %s area", (_area, PageHeader) => {
  it("offers the way back in Vietnamese", () => {
    render(
      <MemoryRouter>
        <PageHeader back title="Tiêu đề" subtitle="Mô tả" />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: /Quay lại/ })).toBeTruthy();
    expect(screen.queryByText("Back")).toBeNull();
  });

  it("shows no way back when the page does not ask for one", () => {
    render(
      <MemoryRouter>
        <PageHeader title="Tiêu đề" subtitle="Mô tả" />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("button", { name: /Quay lại/ })).toBeNull();
  });
});
