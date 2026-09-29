import { useState } from "react";
import { Button, Form, Input } from "antd";
import { Link } from "react-router-dom";
import { AuthCard } from "@/components/guest/auth";

type ForgotPasswordFields = { email: string };

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState<string | null>(null);

  function submit(values: ForgotPasswordFields) {
    setSent(values.email);
  }

  return (
    <AuthCard>
      <h1>Reset your password</h1>
      <p>
        Enter the email address associated with your account.
        <br />
        A password reset link will be sent to that address.
      </p>
      <Form<ForgotPasswordFields>
        layout="vertical"
        requiredMark={false}
        onFinish={submit}
        onValuesChange={() => setSent(null)}
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
        <Button type="primary" htmlType="submit" block>
          Send reset link
        </Button>
      </Form>
      {sent && (
        <div className="auth-confirmation">
          <b>Check your inbox</b>
          <p>
            A password reset link was sent to {sent}. For this demo, continue directly
            to the{" "}
            <Link className="auth-link auth-link-inline" to="/reset-password/demo-token">
              reset password page →
            </Link>
          </p>
        </div>
      )}
      <Link className="auth-link" to="/login">
        Already have access? Sign in
      </Link>
    </AuthCard>
  );
}
