import { Form, Input, message } from "antd";
import { useNavigate } from "react-router-dom";
import {
  LearnerButton,
  LearnerPage,
  PageHeader,
  SectionCard,
} from "@/components/learner/learner.ui";
import "./password.change.scss";

type PasswordFields = { current: string; password: string; confirm: string };

const ChangePassword = () => {
  const navigate = useNavigate();

  function submit() {
    message.success("Password updated.");
    navigate("/learner/profile");
  }

  return (
    <LearnerPage className="learner-change-password">
      <PageHeader
        eyebrow="ACCOUNT / PASSWORD"
        title="Change Password"
        subtitle="Confirm your current password before setting a new one."
        back
      />
      <SectionCard>
        <Form<PasswordFields>
          className="learner-password-form"
          layout="vertical"
          requiredMark={false}
          onFinish={submit}
        >
          <Form.Item
            label="Current password"
            name="current"
            rules={[{ required: true, message: "Enter your current password." }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            label="New password"
            name="password"
            rules={[
              { required: true, message: "Enter a new password." },
              { min: 8, message: "Use at least 8 characters." },
            ]}
          >
            <Input.Password placeholder="Enter new password" />
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
            <Input.Password placeholder="Enter confirm new password" />
          </Form.Item>
          <div className="learner-password-actions">
            <LearnerButton type="primary" htmlType="submit">
              Update password
            </LearnerButton>
          </div>
        </Form>
      </SectionCard>
    </LearnerPage>
  );
};

export default ChangePassword;
