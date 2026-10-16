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

type BackendFailure = {
  error?: { message?: string | string[] } | string;
  message?: string | string[];
};

const failureMessage = (res: unknown, fallback: string) => {
  const body = res as BackendFailure;
  const raw =
    typeof body?.error === "object" ? body.error?.message : body?.message;
  if (Array.isArray(raw)) return raw.join(" ");
  return raw || fallback;
};

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
        else setError(failureMessage(res, "Could not load your profile."));
      } catch {
        if (active) setError("Could not connect to the server.");
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
      setError(failureMessage(res, fallback));
      return false;
    } catch {
      setError("Could not connect to the server. Please try again later.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveName = (fullName: string) =>
    run(
      () => updateMyProfileAPI(fullName),
      "Could not update your profile.",
      setSaving,
    );

  const uploadAvatar = (file: File) => {
    if (!AVATAR_MIME_TYPES.includes(file.type)) {
      setError("Choose a JPG, PNG or WEBP image.");
      return Promise.resolve(false);
    }
    if (file.size > AVATAR_MAX_SIZE_BYTES) {
      setError("The image must be 2 MB or smaller.");
      return Promise.resolve(false);
    }
    return run(
      () => uploadAvatarAPI(file),
      "Could not upload the image.",
      setUploading,
    );
  };

  const removeAvatar = () =>
    run(removeAvatarAPI, "Could not remove the image.", setUploading);

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
