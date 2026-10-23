import { useEffect, useRef, useState } from "react";
import { CheckOutlined } from "@ant-design/icons";
import { Alert, Button, Form, Input } from "antd";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AuthCard, AuthResult } from "@/components/guest/auth";
import { confirmPasswordRules } from "@/hooks/use.change.password";
import { resetPasswordAPI } from "@/services/identity.service";

type ResetPasswordFields = { password: string; confirm: string };

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const [form] = Form.useForm<ResetPasswordFields>();
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const currentToken = useRef(token);
  currentToken.current = token;
  const invalidLink = "This reset link is invalid, expired, or no longer usable. Request a new link.";

  useEffect(() => {
    // Also cover client-side entry. Initial hard loads are protected before CSS
    // requests by the reset-only head guard in index.html.
    const existing = document.querySelector<HTMLMetaElement>('meta[name="referrer"]');
    const policy = existing ?? document.createElement("meta");
    const previous = existing?.content;
    const recoveryPolicy = existing?.id === "password-recovery-referrer";
    policy.name = "referrer";
    policy.content = "no-referrer";
    if (!existing) document.head.appendChild(policy);
    return () => {
      if (previous === undefined || recoveryPolicy) policy.remove();
      else policy.content = previous;
    };
  }, []);

  useEffect(() => {
    setDone(false);
    setError(null);
    form.resetFields();
  }, [token, form]);

  async function submit(values: ResetPasswordFields) {
    if (pending.current || done) return;
    if (!token?.trim()) {
      setError(invalidLink);
      return;
    }
    pending.current = true;
    setSubmitting(true);
    setError(null);
    const submittedToken = token;
    try {
      const result = await resetPasswordAPI({
        token,
        newPassword: values.password,
        confirmPassword: values.confirm,
      });
      if (currentToken.current !== submittedToken) return;
      if (result.success) {
        form.resetFields();
        setDone(true);
      } else {
        setError(result.error === "invalid-token" ? invalidLink
          : "Unable to reset your password right now. Please try again later.");
      }
    } catch {
      if (currentToken.current === submittedToken) {
        setError("Unable to reset your password right now. Please try again later.");
      }
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <AuthCard>
        <AuthResult
          icon={<CheckOutlined />}
          tone="success"
          title="Password reset"
          action={
            <Button type="primary" onClick={() => navigate("/login", { replace: true })}>
              Continue to sign in
            </Button>
          }
        >
          <p>Your password has been updated. Sign in with your new password.</p>
        </AuthResult>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <h1>Set a new password</h1>
      <p>Use the recovery link sent to your registered email.</p>
      {(error || !token?.trim()) && (
        <Alert type="error" showIcon message={error ?? invalidLink} role="alert" />
      )}
      <Form<ResetPasswordFields>
        layout="vertical"
        requiredMark={false}
        form={form}
        disabled={submitting || !token?.trim()}
        onFinish={submit}
        onValuesChange={() => setError(null)}
      >
        <Form.Item
          label="New password"
          name="password"
          rules={[
            { required: true, whitespace: true, message: "Enter a new password." },
            { min: 6, message: "Use at least 6 characters." },
            {
              validator(_, value?: string) {
                // BCrypt's existing backend limit is bytes, not Unicode characters.
                return !value || new TextEncoder().encode(value.trim()).length <= 72
                  ? Promise.resolve()
                  : Promise.reject(new Error("Password is too long. Use fewer characters."));
              },
            },
          ]}
        >
          <Input.Password autoComplete="new-password" placeholder="Enter new password" />
        </Form.Item>
        <Form.Item
          label="Confirm new password"
          name="confirm"
          dependencies={["password"]}
          rules={confirmPasswordRules}
        >
          <Input.Password autoComplete="new-password" placeholder="Enter confirm new password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={submitting} disabled={submitting || !token?.trim()}>
          Reset password
        </Button>
      </Form>
      <Link className="auth-link" to="/forgot-password">
        Request a new reset link
      </Link>
      <br />
      <Link className="auth-link" to="/login">
        Back to sign in
      </Link>
    </AuthCard>
  );
}
