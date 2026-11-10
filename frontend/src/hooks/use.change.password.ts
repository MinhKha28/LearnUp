import { useState } from "react";
import type { Rule } from "antd/es/form";
import { useNavigate } from "react-router-dom";
import { useCurrentApp } from "@/components/context/app.context";
import { changePasswordAPI } from "@/services/identity.service";
import { clearTokens } from "@/utils/auth";
import {
  changePasswordErrorMessage,
  hasMinimumPasswordLength,
  isSameStoredPassword,
  isWithinPasswordByteLimit,
} from "@/utils/password.policy";

export type ChangePasswordFields = {
  current: string;
  password: string;
  confirm: string;
};

export const currentPasswordRules: Rule[] = [
  { required: true, message: "Enter your current password." },
];

export const newPasswordRules: Rule[] = [
  { required: true, whitespace: true, message: "Enter a new password." },
  {
    validator(_, value?: string) {
      return !value || hasMinimumPasswordLength(value, 8)
        ? Promise.resolve()
        : Promise.reject(new Error("Use at least 8 characters."));
    },
  },
  {
    validator(_, value?: string) {
      // The stored limit is BCrypt's 72 bytes, not 72 Unicode characters.
      return !value || isWithinPasswordByteLimit(value)
        ? Promise.resolve()
        : Promise.reject(new Error("Password is too long. Use fewer characters."));
    },
  },
  ({ getFieldValue }) => ({
    validator(_, value?: string) {
      return !value || !isSameStoredPassword(value, getFieldValue("current"))
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
      setError(
        changePasswordErrorMessage(
          (res as unknown as { error?: { code?: string; message?: string } })
            .error,
        ),
      );
    } catch {
      setError("Could not connect to the server. Please try again later.");
    } finally {
      setSubmitting(false);
    }
  };

  return { submit, submitting, error, clearError: () => setError(null) };
};
