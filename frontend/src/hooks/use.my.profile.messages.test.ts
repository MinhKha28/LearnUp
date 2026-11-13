import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/axios.customize", () => ({ tenantAxios: {}, default: {} }));
vi.mock("@/components/context/app.context", () => ({ useCurrentApp: () => ({}) }));
vi.mock("@/services/profile.service", () => ({}));

import { profileErrorMessage, statusLabel } from "./use.my.profile";
import { changePasswordErrorMessage } from "@/utils/password.policy";

const FALLBACK = "Chưa tải ảnh lên được.";

describe("profile error messages", () => {
  it.each([
    ["ACCOUNT_NOT_FOUND", /đăng nhập lại/],
    ["AVATAR_REQUIRED", /chưa chọn ảnh/],
    ["AVATAR_INVALID", /JPG, PNG hoặc WEBP.*2 MB/],
    ["STORAGE_UNAVAILABLE", /thử lại sau ít phút/],
  ])("%s has its own message, from error.code or code", (code, expected) => {
    expect(profileErrorMessage({ error: { code } }, FALLBACK)).toMatch(expected);
    expect(profileErrorMessage({ code }, FALLBACK)).toMatch(expected);
  });

  it("keeps the generic message for an unknown or missing code", () => {
    expect(profileErrorMessage({ error: { code: "SOMETHING_ELSE" } }, FALLBACK)).toBe(FALLBACK);
    expect(profileErrorMessage({ message: "Avatar is too large" }, FALLBACK)).toBe(FALLBACK);
    expect(profileErrorMessage(undefined, FALLBACK)).toBe(FALLBACK);
  });
});

describe("status label", () => {
  it("translates the known statuses and shows an unknown one as it is", () => {
    expect(statusLabel("Active")).toBe("Đang hoạt động");
    expect(statusLabel("Suspended" as never)).toBe("Suspended");
    expect(statusLabel(undefined)).toBe("");
  });
});

describe("change-password messages", () => {
  it("are in Vietnamese", () => {
    expect(changePasswordErrorMessage({ code: "TOO_MANY_ATTEMPTS" })).toMatch(/15 phút/);
    expect(changePasswordErrorMessage(undefined)).toBe("Chưa đổi được mật khẩu. Vui lòng thử lại.");
  });
});
