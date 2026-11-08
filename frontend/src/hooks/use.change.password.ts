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
  "Current password is incorrect": "Mật khẩu hiện tại không đúng.",
  "New password cannot be the same as the current password":
    "Hãy chọn mật khẩu mới khác mật khẩu hiện tại.",
  "New password and confirmation password do not match":
    "Mật khẩu nhập lại không khớp.",
};

export const currentPasswordRules: Rule[] = [
  { required: true, message: "Hãy nhập mật khẩu hiện tại." },
];

export const newPasswordRules: Rule[] = [
  { required: true, message: "Hãy nhập mật khẩu mới." },
  { min: 8, message: "Mật khẩu cần ít nhất 8 ký tự." },
  { max: 72, message: "Mật khẩu tối đa 72 ký tự." },
  ({ getFieldValue }) => ({
    validator(_, value?: string) {
      return !value || value !== getFieldValue("current")
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
      const message =
        (res as unknown as { error?: { message?: string } }).error?.message ??
        "";
      setError(
        BACKEND_MESSAGES[message] ??
          "Chưa đổi được mật khẩu. Vui lòng thử lại.",
      );
    } catch {
      setError("Không kết nối được với máy chủ. Vui lòng thử lại sau.");
    } finally {
      setSubmitting(false);
    }
  };

  return { submit, submitting, error, clearError: () => setError(null) };
};
