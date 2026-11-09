// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/services/axios.customize", () => ({ tenantAxios: {}, default: {} }));
vi.mock("@/services/organization.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/organization.service")>()),
  createRegistrationAPI: vi.fn(),
  getSubscriptionPlansAPI: vi.fn(),
}));
import * as api from "@/services/organization.service";
import RegisterPage from "./register";

const plan = {
  id: "01900000-0000-7000-8000-00000000p001",
  name: "Basic",
  price: 1000000,
  durationDays: 30,
  maxLearners: 50,
  maxInstructors: 5,
  maxCourseChains: 10,
  maxStorageBytes: 1073741824,
};

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
  window.scrollTo = () => {};
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const submitOrganizer = (email: string) => {
  render(
    <MemoryRouter
      initialEntries={[{ pathname: "/register/organizer", state: { plan } }]}
    >
      <Routes>
        <Route path="/register/:screen?" element={<RegisterPage />} />
      </Routes>
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText("Full name"), {
    target: { value: "Lan Nguyen" },
  });
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "Matkhau@123" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create registration" }));
};

describe("UC02 neutral response for an email that already has an account (BR-12)", () => {
  it("goes to the code screen on 202, whose hint covers an existing account", async () => {
    vi.mocked(api.createRegistrationAPI).mockResolvedValue({
      statusCode: 202,
      data: { email: "lan@abc.vn", otpTtlMinutes: 10, message: "ok" },
    } as never);
    submitOrganizer("lan@abc.vn");

    await screen.findByText(
      "If this email already has a LearnUP account, we sent sign-in instructions instead.",
    );
    expect(api.createRegistrationAPI).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("This email is already in use")).toBeNull();
  });

  it("never says the email is in use, even if an old backend still answers 409", async () => {
    vi.mocked(api.createRegistrationAPI).mockResolvedValue({
      statusCode: 409,
      error: {
        code: "EMAIL_ALREADY_USED",
        message: "Email đã được sử dụng cho một tài khoản khác.",
      },
    } as never);
    submitOrganizer("lan@abc.vn");

    await waitFor(() => expect(api.createRegistrationAPI).toHaveBeenCalled());
    await screen.findByText(
      "Some registration details are invalid. Please review them and try again.",
    );
    expect(screen.queryByText("This email is already in use")).toBeNull();
    expect(
      screen.queryByText("This email is already used by another account."),
    ).toBeNull();
    expect(screen.queryByText(/Email đã được sử dụng/)).toBeNull();
  });
});
