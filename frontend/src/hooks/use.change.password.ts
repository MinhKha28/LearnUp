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
  { required: true, message: "Hãy nhập mật khẩu hiện tại." },
];

export const newPasswordRules: Rule[] = [
  { required: true, whitespace: true, message: "Hãy nhập mật khẩu mới." },
  {
    validator(_, value?: string) {
      return !value || hasMinimumPasswordLength(value, 8)
        ? Promise.resolve()
        : Promise.reject(new Error("Mật khẩu cần ít nhất 8 ký tự."));
    },
  },
  {
    validator(_, value?: string) {
      // The stored limit is BCrypt's 72 bytes, not 72 Unicode characters.
      return !value || isWithinPasswordByteLimit(value)
        ? Promise.resolve()
        : Promise.reject(new Error("Mật khẩu quá dài. Hãy dùng ít ký tự hơn."));
    },
  },
  ({ getFieldValue }) => ({
    validator(_, value?: string) {
      return !value || !isSameStoredPassword(value, getFieldValue("current"))
        ? Promise.resolve()
        : Promise.reject(
            new Error("Hãy chọn mật khẩu khác mật khẩu hiện tại."),
          );
    },
  }),
];

export const confirmPasswordRules: Rule[] = [
  { required: true, message: "Hãy nhập lại mật khẩu mới." },
  ({ getFieldValue }) => ({
    validator(_, value?: string) {
      return !value || getFieldValue("password") === value
        ? Promise.resolve()
        : Promise.reject(new Error("Mật khẩu nhập lại không khớp."));
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
      setError("Không kết nối được với máy chủ. Vui lòng thử lại sau.");
    } finally {
      setSubmitting(false);
    }
  };

  return { submit, submitting, error, clearError: () => setError(null) };
};
