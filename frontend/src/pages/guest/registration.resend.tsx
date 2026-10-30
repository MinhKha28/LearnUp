import { useRef, useState } from "react";
import { Alert, Button, Form, Input } from "antd";
import { Link } from "react-router-dom";
import { AuthCard } from "@/components/guest/auth";
import { resendRegistrationEmailAPI } from "@/services/organization.service";
import { normalizeEmail } from "@/utils/helper";

type ResendFields = { email: string };

export default function RegistrationResendPage() {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);

  async function submit(values: ResendFields) {
    if (pending.current) return;
    pending.current = true;
    setSubmitting(true);
    setSent(false);
    setError(null);
    try {
      const res = await resendRegistrationEmailAPI(
        normalizeEmail(values.email),
      );
      if (res.data) {
        setSent(true);
      } else {
        setError(
          "Unable to send the registration email right now. Please try again later.",
        );
      }
    } catch {
      setError("Could not connect to the server. Please try again later.");
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  }

  return (
    <AuthCard>
      <h1>Resend registration email</h1>
      <p>
        Enter the email you used to register your Organization.
        <br />
        If a registration is still waiting for payment, we will send a new link
        and, if your email is not verified yet, a new verification code.
      </p>
      {error && <Alert type="error" showIcon message={error} role="alert" />}
      <Form<ResendFields>
        layout="vertical"
        requiredMark={false}
        disabled={submitting}
        onFinish={submit}
        onValuesChange={() => {
          setSent(false);
          setError(null);
        }}
      >
        <Form.Item
          label="Email address"
          name="email"
          rules={[
            { required: true, message: "Enter your email address." },
            {
              type: "email",
              transform: (value: string) => value?.trim(),
              message: "Enter a valid email address.",
            },
          ]}
        >
          <Input autoComplete="email" placeholder="alex.morgan@example.com" />
        </Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          block
          loading={submitting}
          disabled={submitting}
        >
          Resend email
        </Button>
      </Form>
      {sent && (
        <div className="auth-confirmation" role="status">
          <b>Request received</b>
          <p>
            If this email belongs to a registration waiting for payment, a new
            email is on its way. Previous links and codes no longer work. Check
            your inbox and spam folder.
          </p>
        </div>
      )}
      <Link className="auth-link" to="/forgot-password">
        Already paid? Reset your password instead
      </Link>
      <Link className="auth-link" to="/login">
        Back to sign in
      </Link>
    </AuthCard>
  );
}
