// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use.my.profile", () => ({
  initialsOf: (name: string) => name.slice(0, 2).toUpperCase(),
}));
import { OrganizationLogo } from "./organization.logo";

beforeAll(() => {
  window.matchMedia =
    window.matchMedia ||
    ((query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList);
});
afterEach(cleanup);

const logoButton = () =>
  screen.getByRole("button", { name: "View a larger logo of ABC" });

describe("UC11 organization logo", () => {
  it("is a real button, so Tab reaches it and Enter or Space activates it", () => {
    render(<OrganizationLogo name="ABC" logoUrl="https://cdn.test/logo.png" />);
    const button = logoButton();
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("type")).toBe("button");
    expect(button.getAttribute("tabindex")).not.toBe("-1");
    button.focus();
    expect(document.activeElement).toBe(button);
  });

  it("opens a larger preview when activated", async () => {
    render(<OrganizationLogo name="ABC" logoUrl="https://cdn.test/logo.png" />);
    expect(document.querySelector(".ant-image-preview-img")).toBeNull();
    fireEvent.click(logoButton());
    await waitFor(() =>
      expect(document.querySelector(".ant-image-preview-img")).not.toBeNull(),
    );
  });

  it("returns focus to the logo when Escape closes the preview", async () => {
    render(<OrganizationLogo name="ABC" logoUrl="https://cdn.test/logo.png" />);
    fireEvent.click(logoButton());
    await waitFor(() =>
      expect(document.querySelector(".ant-image-preview-img")).not.toBeNull(),
    );
    fireEvent.keyDown(window, { key: "Escape", keyCode: 27 });
    await waitFor(() => expect(document.activeElement).toBe(logoButton()));
  });

  it("shows initials and no button without a logo", () => {
    render(<OrganizationLogo name="Cong Ty" logoUrl={null} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("CO")).toBeTruthy();
    expect(document.querySelector(".ant-image")).toBeNull();
  });
});
