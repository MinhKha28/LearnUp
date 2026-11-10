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

  it("maps the change-password throttle and known backend errors", () => {
    expect(changePasswordErrorMessage({ code: "TOO_MANY_ATTEMPTS", message: "x" })).toMatch(/Too many incorrect/);
    expect(changePasswordErrorMessage({ message: "Current password is incorrect" })).toBe(
      "Current password is incorrect.",
    );
    expect(changePasswordErrorMessage({ message: "New password cannot be the same as the current password" })).toMatch(
      /different from the current one/,
    );
    expect(changePasswordErrorMessage(undefined)).toBe("The password could not be changed. Please try again.");
  });
});
