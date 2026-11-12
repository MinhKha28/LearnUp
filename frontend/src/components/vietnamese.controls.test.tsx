// @vitest-environment jsdom
import { Button, Input, Pagination } from "antd";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { VietnameseAlert, VietnamesePassword, VietnameseRangePicker } from "./vietnamese.controls";
import { vietnameseClear, vietnamesePageItem } from "./vietnamese.control.props";

beforeEach(() => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    matches: false,
    addListener: vi.fn(),
    removeListener: vi.fn(),
  })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("gives the password toggle a Vietnamese name and preserves its behavior", () => {
  render(<VietnamesePassword aria-label="Mật khẩu" defaultValue="fixture" />);
  const field = screen.getByLabelText<HTMLInputElement>("Mật khẩu");
  expect(field.type).toBe("password");
  fireEvent.click(screen.getByRole("button", { name: "Hiện mật khẩu" }));
  expect(field.type).toBe("text");
  fireEvent.click(screen.getByRole("button", { name: "Ẩn mật khẩu" }));
  expect(field.type).toBe("password");
});

it("keeps the clear action and names its existing button", () => {
  const onChange = vi.fn();
  render(<Input aria-label="Mã" defaultValue="abc" allowClear={vietnameseClear} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Xóa giá trị" }));
  expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Mã" }).value).toBe("");
  expect(onChange).toHaveBeenCalledOnce();
});

it("keeps date placeholders and Alert content while hiding the library glyphs", () => {
  const { container } = render(
    <>
      <VietnameseRangePicker placeholder={["Từ ngày", "Đến ngày"]} />
      <VietnameseAlert type="error" showIcon message="Tải thất bại" action={<Button>Thử lại</Button>} />
    </>,
  );
  expect(screen.getByPlaceholderText("Từ ngày")).toBeTruthy();
  expect(screen.getByPlaceholderText("Đến ngày")).toBeTruthy();
  expect(screen.getByRole("alert").textContent).toContain("Tải thất bại");
  expect(container.querySelector('[aria-label="to"]')).toBeNull();
  expect(screen.queryByRole("img", { name: /calendar|close-circle|swap-right/ })).toBeNull();
});

it("names pagination buttons in Vietnamese and keeps their actions", () => {
  const onChange = vi.fn();
  render(<Pagination defaultCurrent={2} total={30} onChange={onChange} itemRender={vietnamesePageItem} />);
  expect(screen.getByRole("button", { name: "Trang trước" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
  expect(onChange).toHaveBeenCalledWith(3, 10);
});
