// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const { loadGoogleIdentity } = vi.hoisted(() => ({ loadGoogleIdentity: vi.fn() }));

vi.mock("@/services/identity.service", () => ({
  googleLoginAPI: vi.fn(),
  loginAPI: vi.fn(),
}));
vi.mock("@/services/profile.service", () => ({ loadUserWithProfile: vi.fn() }));
vi.mock("@/components/context/app.context", () => ({
  useCurrentApp: () => ({ setUser: vi.fn(), setIsAuthenticated: vi.fn() }),
}));
vi.mock("@/services/google.identity", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/google.identity")>()),
  loadGoogleIdentity,
}));

import LoginPage from "@/pages/guest/login";

beforeAll(() => {
  window.matchMedia = (media) => ({
    matches: false,
    media,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  loadGoogleIdentity.mockReset();
});

const showLogin = (path = "/login") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <LoginPage />
    </MemoryRouter>,
  );

describe("UC05 sign-in reason in the address", () => {
  it("shows the message of a known reason", () => {
    showLogin("/login?reason=ACCOUNT_DEACTIVATED");
    expect(screen.getByText(/Tài khoản của bạn đã bị vô hiệu hóa/)).toBeTruthy();
  });

  it.each(["constructor", "toString", "__proto__"])("shows no error for the inherited key %s", (reason) => {
    const { container } = showLogin(`/login?reason=${reason}`);
    expect(screen.queryByText("Đăng nhập không thành công")).toBeNull();
    expect(container.querySelector(".ant-alert-error")).toBeNull();
  });
});

describe("UC05.1 Google sign-in on the login page", () => {
  it("hides the divider, the Google button and its help text without a client ID", () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "");
    const { container } = showLogin();
    expect(screen.getByRole("button", { name: "Đăng nhập" })).toBeTruthy();
    expect(screen.queryByText("hoặc")).toBeNull();
    expect(screen.queryByText(/đăng nhập bằng Google/)).toBeNull();
    expect(container.querySelector(".login-google, .login-google-gis")).toBeNull();
    expect(loadGoogleIdentity).not.toHaveBeenCalled();
  });

  it("shows the divider, the Google container and its help text with a client ID", () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "1234567890-test.apps.googleusercontent.com");
    loadGoogleIdentity.mockReturnValue(new Promise(() => {}));
    const { container } = showLogin();
    expect(screen.getByText("hoặc")).toBeTruthy();
    expect(screen.getByText(/đăng nhập bằng Google/)).toBeTruthy();
    expect(container.querySelector(".login-google-gis")).not.toBeNull();
  });

  it("keeps the Vietnamese fallback button when the Google script cannot load", async () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "1234567890-test.apps.googleusercontent.com");
    loadGoogleIdentity.mockRejectedValue(new Error("blocked"));
    showLogin();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Tiếp tục với Google/ })).toBeTruthy(),
    );
    screen.getByRole("button", { name: /Tiếp tục với Google/ }).click();
    expect(
      await screen.findByText("Tính năng đăng nhập bằng Google đang gián đoạn. Vui lòng đăng nhập bằng email và mật khẩu."),
    ).toBeTruthy();
  });
});
