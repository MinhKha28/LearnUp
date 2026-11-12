// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { VietnameseInputNumber } from "./vietnamese.input.number";

afterEach(cleanup);

it("keeps the native step controls with Vietnamese names and a decimal comma", () => {
  const onChange = vi.fn();
  render(
    <VietnameseInputNumber aria-label="Điểm" defaultValue={1.5} step={0.5} onChange={onChange} />,
  );

  expect(screen.getByRole<HTMLInputElement>("spinbutton", { name: "Điểm" }).value).toBe("1,5");
  fireEvent.mouseDown(screen.getByRole("button", { name: "Tăng giá trị" }));
  fireEvent.mouseUp(screen.getByRole("button", { name: "Tăng giá trị" }));
  expect(onChange).toHaveBeenLastCalledWith(2);
  fireEvent.mouseDown(screen.getByRole("button", { name: "Giảm giá trị" }));
  fireEvent.mouseUp(screen.getByRole("button", { name: "Giảm giá trị" }));
  expect(onChange).toHaveBeenLastCalledWith(1.5);
});
