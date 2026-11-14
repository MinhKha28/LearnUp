// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getMyProfileAPI } = vi.hoisted(() => ({ getMyProfileAPI: vi.fn() }));

vi.mock("@/components/context/app.context", () => ({
  useCurrentApp: () => ({ user: null, setUser: vi.fn() }),
}));
vi.mock("@/services/profile.service", () => ({
  getMyProfileAPI,
  removeAvatarAPI: vi.fn(),
  updateMyProfileAPI: vi.fn(),
  uploadAvatarAPI: vi.fn(),
  withProfile: vi.fn(),
}));

import { useMyProfile } from "./use.my.profile";

afterEach(() => {
  getMyProfileAPI.mockReset();
});

const loadError = async (response: unknown) => {
  getMyProfileAPI.mockResolvedValue(response);
  const { result } = renderHook(() => useMyProfile());
  await waitFor(() => expect(result.current.loading).toBe(false));
  return result.current.error;
};

describe("UC09 first profile load", () => {
  it("tells the user to sign in again when the account is not found", async () => {
    expect(await loadError({ statusCode: 404, error: { code: "ACCOUNT_NOT_FOUND" } })).toBe(
      "Không tìm thấy tài khoản của bạn. Hãy đăng nhập lại.",
    );
  });

  it("keeps the generic load message for another or an inherited code", async () => {
    expect(await loadError({ statusCode: 500, error: { code: "INTERNAL_ERROR" } })).toBe(
      "Không tải được hồ sơ của bạn.",
    );
    expect(await loadError({ statusCode: 400, error: { code: "constructor" } })).toBe(
      "Không tải được hồ sơ của bạn.",
    );
  });

  it.each(["AVATAR_REQUIRED", "AVATAR_INVALID", "STORAGE_UNAVAILABLE"])(
    "keeps the generic load message for the avatar code %s, which belongs to the avatar actions",
    async (code) => {
      expect(await loadError({ statusCode: 400, error: { code } })).toBe("Không tải được hồ sơ của bạn.");
    },
  );

  it("shows the connection message when the request fails", async () => {
    getMyProfileAPI.mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => useMyProfile());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Không kết nối được với máy chủ.");
  });
});
