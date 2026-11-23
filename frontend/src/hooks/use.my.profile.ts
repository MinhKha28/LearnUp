import { useCallback, useEffect, useState } from "react";
import { useCurrentApp } from "@/components/context/app.context";
import {
  getMyProfileAPI,
  removeAvatarAPI,
  updateMyProfileAPI,
  uploadAvatarAPI,
  withProfile,
} from "@/services/profile.service";
import type { IMyProfile, ProfileStatus } from "@/types/profile.types";

export const AVATAR_MAX_SIZE_BYTES = 2 * 1024 * 1024;
export const AVATAR_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const initialsOf = (name?: string | null) =>
  (name ?? "")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export const statusTone = (
  status?: ProfileStatus,
): "success" | "warning" | "error" =>
  status === "Active" ? "success" : status === "Pending" ? "warning" : "error";

const STATUS_LABELS: Record<ProfileStatus, string> = {
  Pending: "Chưa kích hoạt",
  Active: "Đang hoạt động",
  Deactivated: "Đã vô hiệu hóa",
};

export const statusLabel = (status?: ProfileStatus) =>
  status ? (Object.hasOwn(STATUS_LABELS, status) ? STATUS_LABELS[status] : status) : "";

const PROFILE_ERROR_MESSAGES: Record<string, string> = {
  ACCOUNT_NOT_FOUND: "Không tìm thấy tài khoản của bạn. Hãy đăng nhập lại.",
  AVATAR_REQUIRED: "Bạn chưa chọn ảnh. Hãy chọn một ảnh để tải lên.",
  AVATAR_INVALID:
    "Ảnh không hợp lệ. Hãy chọn ảnh JPG, PNG hoặc WEBP, dung lượng tối đa 2 MB.",
  STORAGE_UNAVAILABLE:
    "Chưa lưu được ảnh vì kho lưu trữ đang gián đoạn. Vui lòng thử lại sau ít phút.",
};

const errorCodeOf = (response: unknown): unknown => {
  const body = (response ?? {}) as {
    code?: unknown;
    error?: { code?: unknown };
  };
  return body.error?.code ?? body.code;
};

export const profileErrorMessage = (
  response: unknown,
  fallback: string,
): string => {
  const code = errorCodeOf(response);
  return typeof code === "string" && Object.hasOwn(PROFILE_ERROR_MESSAGES, code)
    ? PROFILE_ERROR_MESSAGES[code]
    : fallback;
};

export const PROFILE_LOAD_ERROR = "Không tải được hồ sơ của bạn.";

export const profileLoadErrorMessage = (response: unknown): string =>
  errorCodeOf(response) === "ACCOUNT_NOT_FOUND"
    ? PROFILE_ERROR_MESSAGES.ACCOUNT_NOT_FOUND
    : PROFILE_LOAD_ERROR;

export const useMyProfile = () => {
  const { user, setUser } = useCurrentApp();
  const [profile, setProfile] = useState<IMyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await getMyProfileAPI();
        if (!active) return;
        if (res.data) setProfile(res.data);
        else setError(profileLoadErrorMessage(res));
      } catch {
        if (active) setError("Không kết nối được với máy chủ.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const apply = useCallback(
    (next: IMyProfile) => {
      setProfile(next);
      if (user) setUser(withProfile(user, next));
    },
    [user, setUser],
  );

  const run = async (
    request: () => Promise<unknown>,
    fallback: string,
    setBusy: (busy: boolean) => void,
  ) => {
    setBusy(true);
    setError(null);
    try {
      const res = (await request()) as IBackendRes<IMyProfile>;
      if (res.data) {
        apply(res.data);
        return true;
      }
      setError(profileErrorMessage(res, fallback));
      return false;
    } catch {
      setError("Không kết nối được với máy chủ. Vui lòng thử lại sau.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveName = (fullName: string) =>
    run(
      () => updateMyProfileAPI(fullName),
      "Chưa cập nhật được hồ sơ.",
      setSaving,
    );

  const uploadAvatar = (file: File) => {
    if (!AVATAR_MIME_TYPES.includes(file.type)) {
      setError("Hãy chọn ảnh JPG, PNG hoặc WEBP.");
      return Promise.resolve(false);
    }
    if (file.size > AVATAR_MAX_SIZE_BYTES) {
      setError("Ảnh tối đa 2 MB.");
      return Promise.resolve(false);
    }
    return run(
      () => uploadAvatarAPI(file),
      "Chưa tải ảnh lên được.",
      setUploading,
    );
  };

  const removeAvatar = () =>
    run(removeAvatarAPI, "Chưa gỡ được ảnh.", setUploading);

  return {
    profile,
    loading,
    saving,
    uploading,
    error,
    clearError: () => setError(null),
    saveName,
    uploadAvatar,
    removeAvatar,
  };
};
