import { Alert, Form, Input } from "antd";
import {
  LearnerButton,
  LearnerPage,
  PageHeader,
  SectionCard,
} from "@/components/learner/learner.ui";
import {
  confirmPasswordRules,
  currentPasswordRules,
  newPasswordRules,
  useChangePassword,
  type ChangePasswordFields,
} from "@/hooks/use.change.password";
import "./password.change.scss";

const ChangePassword = () => {
  const { submit, submitting, error, clearError } = useChangePassword();

  return (
    <LearnerPage className="learner-change-password">
      <PageHeader
        eyebrow="ACCOUNT / PASSWORD"
        title="Change Password"
        subtitle="Confirm your current password before setting a new one."
        back
      />
      <SectionCard>
        {error && <Alert type="error" showIcon message={error} role="alert" />}
        <Form<ChangePasswordFields>
          className="learner-password-form"
          layout="vertical"
          requiredMark={false}
          disabled={submitting}
          onFinish={submit}
          onValuesChange={clearError}
        >
          <Form.Item
            label="Current password"
            name="current"
            rules={currentPasswordRules}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            label="New password"
            name="password"
            dependencies={["current"]}
            rules={newPasswordRules}
          >
            <Input.Password placeholder="Enter new password" />
          </Form.Item>
          <Form.Item
            label="Confirm new password"
            name="confirm"
            dependencies={["password"]}
            rules={confirmPasswordRules}
          >
            <Input.Password placeholder="Enter confirm new password" />
          </Form.Item>
          <div className="learner-password-actions">
            <LearnerButton type="primary" htmlType="submit" loading={submitting}>
              Update password
            </LearnerButton>
          </div>
        </Form>
      </SectionCard>
    </LearnerPage>
  );
};

export default ChangePassword;
