import { ExclamationCircleFilled } from "@ant-design/icons";
import { Button, Form, Input } from "antd";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AuthCard, AuthResult } from "@/components/guest/auth";

type ActivateFields = { password: string; confirm: string };

// Invitation Activation is reached from an emailed invitation link. A token that
// looks expired/invalid renders the Invitation Link Error state instead of the form.
const isInvalidToken = (token?: string) =>
  !token || /expired|invalid/i.test(token);

export default function ActivatePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm<ActivateFields>();

  if (isInvalidToken(token)) {
    return (
      <AuthCard>
        <AuthResult
          icon={<ExclamationCircleFilled />}
          title="Invitation link unavailable"
          action={
            <Link to="/login">
              <Button>Back to sign in</Button>
            </Link>
          }
        >
          <p>This invitation link has expired or is no longer valid.</p>
          <p>Contact your Organizer to receive a new invitation.</p>
        </AuthResult>
      </AuthCard>
    );
  }

  function submit() {
    navigate(`/activate/${token}/success`);
  }

  return (
    <AuthCard>
      <span className="auth-badge">INVITED LEARNER</span>
      <h1>Activate your LearnUP account</h1>
      <p>
        Your Organization invited you to join its training workspace.
        <br />
        Set your password to activate this Learner account.
      </p>
      <Form<ActivateFields>
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{ password: "", confirm: "" }}
        onFinish={submit}
      >
        <Form.Item label="Organization">
          <Input value="Demo Organization" disabled />
        </Form.Item>
        <Form.Item label="Email address">
          <Input value="alex.morgan@example.com" disabled />
        </Form.Item>
        <Form.Item
          label="Password"
          name="password"
          rules={[
            { required: true, message: "Enter a password." },
            { min: 8, message: "Use at least 8 characters." },
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          label="Confirm password"
          name="confirm"
          dependencies={["password"]}
          rules={[
            { required: true, message: "Confirm your password." },
            ({ getFieldValue }) => ({
              validator(_, value) {
                return !value || getFieldValue("password") === value
                  ? Promise.resolve()
                  : Promise.reject(new Error("Passwords do not match"));
              },
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block>
          Activate account
        </Button>
      </Form>
      <p className="auth-hint">The invitation link is associated with this email address.</p>
    </AuthCard>
  );
}
