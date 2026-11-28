import { describe, expect, it } from "vitest";
import {
  changePasswordErrorMessage,
  hasMinimumPasswordLength,
  isSameStoredPassword,
  isWithinPasswordByteLimit,
  passwordByteLength,
} from "@/utils/password.policy";

describe("UC08 password policy helpers", () => {
  it("measures the 72-byte BCrypt limit on trimmed UTF-8 bytes, not characters", () => {
    expect(isWithinPasswordByteLimit("a".repeat(72))).toBe(true);
    expect(isWithinPasswordByteLimit("a".repeat(73))).toBe(false);
    expect(isWithinPasswordByteLimit("€".repeat(25))).toBe(false); // 25 characters, 75 bytes
    expect(isWithinPasswordByteLimit(`  ${"a".repeat(72)}  `)).toBe(true);
    expect(passwordByteLength(" é ")).toBe(2);
  });

  it("applies the minimum length to the stored (trimmed) password", () => {
    expect(hasMinimumPasswordLength("   abc    ", 6)).toBe(false);
    expect(hasMinimumPasswordLength(" abcdef ", 6)).toBe(true);
    expect(hasMinimumPasswordLength("abcdefg", 8)).toBe(false);
  });

  it("treats inputs that differ only by surrounding spaces as the same password", () => {
    expect(isSameStoredPassword(" secret123 ", "secret123")).toBe(true);
    expect(isSameStoredPassword("secret123", "secret124")).toBe(false);
    expect(isSameStoredPassword("secret123", undefined)).toBe(false);
  });

  it("maps the change-password throttle and each rejection code", () => {
    expect(changePasswordErrorMessage({ code: "TOO_MANY_ATTEMPTS", message: "x" })).toMatch(/quá nhiều lần/);
    expect(changePasswordErrorMessage({ code: "CURRENT_PASSWORD_INCORRECT" })).toBe("Mật khẩu hiện tại không đúng.");
    expect(changePasswordErrorMessage({ code: "NEW_PASSWORD_SAME_AS_CURRENT" })).toBe(
      "Hãy chọn mật khẩu mới khác mật khẩu hiện tại.",
    );
    expect(changePasswordErrorMessage({ code: "PASSWORD_CONFIRMATION_MISMATCH" })).toBe("Mật khẩu nhập lại không khớp.");
    expect(changePasswordErrorMessage(undefined)).toBe("Chưa đổi được mật khẩu. Vui lòng thử lại.");
  });

  it("lets a known code decide the message, whatever the English message says", () => {
    expect(changePasswordErrorMessage({ code: "CURRENT_PASSWORD_INCORRECT", message: "Reworded by the server" })).toBe(
      "Mật khẩu hiện tại không đúng.",
    );
    expect(
      changePasswordErrorMessage({
        code: "PASSWORD_CONFIRMATION_MISMATCH",
        message: "Current password is incorrect",
      }),
    ).toBe("Mật khẩu nhập lại không khớp.");
  });

  it("falls back to the English messages of an Identity without the per-reason codes", () => {
    expect(changePasswordErrorMessage({ code: "BAD_REQUEST", message: "Current password is incorrect" })).toBe(
      "Mật khẩu hiện tại không đúng.",
    );
    expect(
      changePasswordErrorMessage({
        code: "BAD_REQUEST",
        message: "New password cannot be the same as the current password",
      }),
    ).toBe("Hãy chọn mật khẩu mới khác mật khẩu hiện tại.");
    expect(
      changePasswordErrorMessage({
        code: "BAD_REQUEST",
        message: "New password and confirmation password do not match",
      }),
    ).toBe("Mật khẩu nhập lại không khớp.");
  });

  it("shows the generic message for any other code or message", () => {
    expect(changePasswordErrorMessage({ code: "BAD_REQUEST", message: "Something else" })).toBe(
      "Chưa đổi được mật khẩu. Vui lòng thử lại.",
    );
    expect(changePasswordErrorMessage({ code: "toString", message: "toString" })).toBe(
      "Chưa đổi được mật khẩu. Vui lòng thử lại.",
    );
    expect(changePasswordErrorMessage({ message: "Current password is incorrect " })).toBe(
      "Chưa đổi được mật khẩu. Vui lòng thử lại.",
    );
  });
});
