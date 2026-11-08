// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { PageHeader } from "./learner.ui";

describe("PageHeader of the learner area", () => {
  afterEach(cleanup);

  it("offers the way back in Vietnamese", () => {
    render(
      <MemoryRouter>
        <PageHeader back title="Chấm chéo" subtitle="Các bài được giao" />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: /Quay lại/ })).toBeTruthy();
    expect(screen.queryByText("Back")).toBeNull();
  });

  it("shows no way back when the page does not ask for one", () => {
    render(
      <MemoryRouter>
        <PageHeader title="Chấm chéo" subtitle="Các bài được giao" />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("button", { name: /Quay lại/ })).toBeNull();
  });
});
