import { useRef, useState } from "react";
import { Alert, Button, Form, Input } from "antd";
import { Link } from "react-router-dom";
import { AuthCard } from "@/components/guest/auth";
import { forgotPasswordAPI } from "@/services/identity.service";

type ForgotPasswordFields = { email: string };

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);

  async function submit(values: ForgotPasswordFields) {
    if (pending.current) return;
    pending.current = true;
    setSubmitting(true);
    setSent(false);
    setError(null);
    try {
      const result = await forgotPasswordAPI({ email: values.email.trim() });
      if (result.success) {
        setSent(true);
      } else {
        setError("Unable to request password recovery right now. Please try again later.");
      }
    } catch {
      setError("Unable to request password recovery right now. Please try again later.");
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  }

  return (
    <AuthCard>
      <h1>Reset your password</h1>
      <p>
        Enter the email address associated with your account.
        <br />
        If your account is eligible, we will attempt to send recovery instructions.
      </p>
      {error && <Alert type="error" showIcon message={error} role="alert" />}
      <Form<ForgotPasswordFields>
        layout="vertical"
        requiredMark={false}
        disabled={submitting}
        onFinish={submit}
        onValuesChange={() => { setSent(false); setError(null); }}
      >
        <Form.Item
          label="Email address"
          name="email"
          rules={[
            { required: true, message: "Enter your email address." },
            { type: "email", message: "Enter a valid email address." },
          ]}
        >
          <Input autoComplete="email" placeholder="alex.morgan@example.com" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={submitting} disabled={submitting}>
          Send reset link
        </Button>
      </Form>
      {sent && (
        <div className="auth-confirmation" role="status">
          <b>Request received</b>
          <p>
            If this email is eligible for recovery, we will attempt to send instructions.
            Check your inbox and spam folder; delivery is not guaranteed.
          </p>
        </div>
      )}
      <Link className="auth-link" to="/login">
        Already have access? Sign in
      </Link>
    </AuthCard>
  );
}
