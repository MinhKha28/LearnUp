import { useState } from "react";
import type { Rule } from "antd/es/form";
import { useNavigate } from "react-router-dom";
import { useCurrentApp } from "@/components/context/app.context";
import { changePasswordAPI } from "@/services/identity.service";
import { clearTokens } from "@/utils/auth";

export type ChangePasswordFields = {
  current: string;
  password: string;
  confirm: string;
};

const BACKEND_MESSAGES: Record<string, string> = {
  "Current password is incorrect": "Current password is incorrect.",
  "New password cannot be the same as the current password":
    "Choose a new password that is different from the current one.",
  "New password and confirmation password do not match":
    "Passwords do not match.",
};

export const currentPasswordRules: Rule[] = [
  { required: true, message: "Enter your current password." },
];

export const newPasswordRules: Rule[] = [
  { required: true, message: "Enter a new password." },
  { min: 8, message: "Use at least 8 characters." },
  { max: 72, message: "Use at most 72 characters." },
  ({ getFieldValue }) => ({
    validator(_, value?: string) {
      return !value || value !== getFieldValue("current")
        ? Promise.resolve()
        : Promise.reject(
            new Error("Choose a password different from the current one."),
          );
    },
  }),
];

export const confirmPasswordRules: Rule[] = [
  { required: true, message: "Confirm your new password." },
  ({ getFieldValue }) => ({
    validator(_, value?: string) {
      return !value || getFieldValue("password") === value
        ? Promise.resolve()
        : Promise.reject(new Error("Passwords do not match"));
    },
  }),
];

export const useChangePassword = () => {
  const navigate = useNavigate();
  const { setUser, setIsAuthenticated } = useCurrentApp();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (values: ChangePasswordFields) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await changePasswordAPI({
        currentPassword: values.current,
        newPassword: values.password,
        confirmPassword: values.confirm,
      });
      if (res.data) {
        clearTokens();
        setUser(null);
        setIsAuthenticated(false);
        navigate("/login?state=password-changed", { replace: true });
        return;
      }
      const message =
        (res as unknown as { error?: { message?: string } }).error?.message ??
        "";
      setError(
        BACKEND_MESSAGES[message] ??
          "The password could not be changed. Please try again.",
      );
    } catch {
      setError("Could not connect to the server. Please try again later.");
    } finally {
      setSubmitting(false);
    }
  };

  return { submit, submitting, error, clearError: () => setError(null) };
};
