// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/services/axios.customize", () => ({ tenantAxios: {}, default: {} }));
vi.mock("@/services/organization.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/organization.service")>()),
  resendRegistrationEmailAPI: vi.fn(),
}));
import * as api from "@/services/organization.service";
import RegistrationResendPage from "./registration.resend";

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
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const submit = (email: string) => {
  render(
    <MemoryRouter>
      <RegistrationResendPage />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText("Địa chỉ email"), {
    target: { value: email },
  });
  fireEvent.click(screen.getByRole("button", { name: "Gửi lại thư" }));
};

describe("UC03.1 resend registration email", () => {
  it("sends the normalised email and shows the neutral confirmation", async () => {
    vi.mocked(api.resendRegistrationEmailAPI).mockResolvedValue({
      statusCode: 202,
      data: { email: "lan@abc.vn", otpTtlMinutes: 10, message: "ok" },
    } as never);
    submit("  Lan@ABC.vn ");
    await screen.findByText("Đã nhận yêu cầu");
    expect(api.resendRegistrationEmailAPI).toHaveBeenCalledWith("lan@abc.vn");
    expect(screen.getByRole("status").textContent).toContain(
      "Liên kết và mã trước đó không còn dùng được",
    );
  });

  it("shows a generic error when the request fails, never a backend detail", async () => {
    vi.mocked(api.resendRegistrationEmailAPI).mockResolvedValue({
      statusCode: 400,
      message: "Email không hợp lệ",
    } as never);
    submit("lan@abc.vn");
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "Hiện chưa gửi được thư đăng ký",
      ),
    );
    expect(screen.queryByText("Đã nhận yêu cầu")).toBeNull();
    expect(screen.queryByText("Email không hợp lệ")).toBeNull();
  });

  it("shows a connection error when the server cannot be reached", async () => {
    vi.mocked(api.resendRegistrationEmailAPI).mockRejectedValue(
      new Error("Network Error"),
    );
    submit("lan@abc.vn");
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "Không kết nối được với máy chủ",
      ),
    );
  });
});
