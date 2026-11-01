// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

describe("UC11 organization logo", () => {
  it("opens a larger preview when the logo is clicked", async () => {
    render(<OrganizationLogo name="ABC" logoUrl="https://cdn.test/logo.png" />);
    expect(document.querySelector(".ant-image-preview")).toBeNull();
    fireEvent.click(screen.getByAltText("ABC logo"));
    expect(await screen.findAllByAltText("ABC logo")).toHaveLength(2);
    expect(document.querySelector(".ant-image-preview")).not.toBeNull();
  });

  it("shows initials and no preview without a logo", () => {
    render(<OrganizationLogo name="Cong Ty" logoUrl={null} />);
    expect(screen.queryByRole("img", { name: /logo/ })).toBeNull();
    expect(document.querySelector(".ant-image")).toBeNull();
  });
});
