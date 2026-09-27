import { useState } from "react";
import { CheckOutlined } from "@ant-design/icons";
import { Button, Form, Input } from "antd";
import { useNavigate } from "react-router-dom";
import { AuthCard, AuthResult } from "@/components/guest/auth";

type ResetPasswordFields = { password: string; confirm: string };

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <AuthCard>
        <AuthResult
          icon={<CheckOutlined />}
          tone="success"
          title="Password reset"
          action={
            <Button type="primary" onClick={() => navigate("/login")}>
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
      <Form<ResetPasswordFields>
        layout="vertical"
        requiredMark={false}
        onFinish={() => setDone(true)}
      >
        <Form.Item
          label="New password"
          name="password"
          rules={[
            { required: true, message: "Enter a new password." },
            { min: 8, message: "Use at least 8 characters." },
          ]}
        >
          <Input.Password autoComplete="new-password" placeholder="Enter new password" />
        </Form.Item>
        <Form.Item
          label="Confirm new password"
          name="confirm"
          dependencies={["password"]}
          rules={[
            { required: true, message: "Confirm your new password." },
            ({ getFieldValue }) => ({
              validator(_, value) {
                return !value || getFieldValue("password") === value
                  ? Promise.resolve()
                  : Promise.reject(new Error("Passwords do not match"));
              },
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" placeholder="Enter confirm new password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block>
          Reset password
        </Button>
      </Form>
    </AuthCard>
  );
}
