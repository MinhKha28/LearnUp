import { CheckCircleOutlined } from "@ant-design/icons";
import { Alert, Form, Input } from "antd";
import { useNavigate } from "react-router-dom";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
} from "@/components/organizer/organizer.ui";
import {
  confirmPasswordRules,
  currentPasswordRules,
  newPasswordRules,
  useChangePassword,
  type ChangePasswordFields,
} from "@/hooks/use.change.password";
import "./password.change.scss";

const ChangePassword = () => {
  const navigate = useNavigate();
  const { submit, submitting, error, clearError } = useChangePassword();
  return (
    <OrganizerPage className="organizer-change-password">
      <PageHeader
        title="Change Password"
        subtitle="Verify your current password before setting a new one."
        back
      />
      <div className="organizer-password-grid">
        <SectionCard title="Password settings">
          {error && <Alert type="error" showIcon message={error} role="alert" />}
          <Form<ChangePasswordFields>
            className="organizer-form"
            layout="vertical"
            disabled={submitting}
            onFinish={submit}
            onValuesChange={clearError}
          >
            <Form.Item label="Current password" name="current" rules={currentPasswordRules}>
              <Input.Password />
            </Form.Item>
            <Form.Item label="New password" name="password" dependencies={["current"]} rules={newPasswordRules}>
              <Input.Password />
            </Form.Item>
            <Form.Item
              label="Confirm new password"
              name="confirm"
              dependencies={["password"]}
              rules={confirmPasswordRules}
            >
              <Input.Password />
            </Form.Item>
            <div className="organizer-form-actions">
              <OrganizerButton onClick={() => navigate(-1)}>Cancel</OrganizerButton>
              <OrganizerButton type="primary" htmlType="submit" loading={submitting}>
                Update password
              </OrganizerButton>
            </div>
          </Form>
        </SectionCard>
        <aside className="organizer-password-rules">
          <h2>Account access</h2>
          <p>
            <CheckCircleOutlined /> Organizer uses email + password
          </p>
          <p>
            <CheckCircleOutlined /> Google login does not apply to Organizer
          </p>
          <p>
            <CheckCircleOutlined /> Password recovery uses the registered email
          </p>
          <p>
            <CheckCircleOutlined /> After the change you sign in again on every device
          </p>
        </aside>
      </div>
    </OrganizerPage>
  );
};

export default ChangePassword;
