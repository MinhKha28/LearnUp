// @vitest-environment jsdom
// Back goes one step in the history; a page opened by its own address goes to the list instead of leaving the app.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { useGoBack } from "./use.go.back";

const Page = () => {
  const goBack = useGoBack();
  const location = useLocation();
  return (
    <>
      <span data-testid="at">{location.pathname}</span>
      <button onClick={() => goBack()}>back</button>
    </>
  );
};
const open = (entries: string[], index: number, idx: number) => {
  window.history.replaceState({ idx }, "");
  render(
    <MemoryRouter initialEntries={entries} initialIndex={index}>
      <Page />
    </MemoryRouter>,
  );
};
afterEach(() => {
  cleanup();
  window.history.replaceState(null, "");
});

describe("useGoBack", () => {
  it("goes back to the screen the Instructor came from", () => {
    open(["/instructor/submissions", "/instructor/submissions/1"], 1, 1);
    fireEvent.click(screen.getByText("back"));
    expect(screen.getByTestId("at").textContent).toBe("/instructor/submissions");
  });

  it("goes to the list when the page was opened by its address", () => {
    open(["/instructor/submissions/1"], 0, 0);
    fireEvent.click(screen.getByText("back"));
    expect(screen.getByTestId("at").textContent).toBe("/instructor/submissions");
  });
});
