import { CheckCircleOutlined } from "@ant-design/icons";
import { Alert, Form, Input } from "antd";
import { useNavigate } from "react-router-dom";
import { AdminButton, AdminPage, PageHeader, SectionCard } from "@/components/admin/admin.ui";
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
    <AdminPage className="admin-change-password">
      <PageHeader title="Change Password" subtitle="Verify your current password before setting a new one." />
      <div className="admin-password-grid">
        <SectionCard title="Password settings">
          {error && <Alert type="error" showIcon message={error} role="alert" />}
          <Form<ChangePasswordFields>
            className="admin-form"
            layout="vertical"
            disabled={submitting}
            onFinish={submit}
            onValuesChange={clearError}
          >
            <Form.Item label="Current password" name="current" rules={currentPasswordRules}>
              <Input.Password autoComplete="current-password" />
            </Form.Item>
            <Form.Item label="New password" name="password" dependencies={["current"]} rules={newPasswordRules}>
              <Input.Password autoComplete="new-password" />
            </Form.Item>
            <Form.Item label="Confirm new password" name="confirm" dependencies={["password"]} rules={confirmPasswordRules}>
              <Input.Password autoComplete="new-password" />
            </Form.Item>
            <div className="admin-form-actions">
              <AdminButton onClick={() => navigate(-1)}>Cancel</AdminButton>
              <AdminButton type="primary" htmlType="submit" loading={submitting}>
                Update password
              </AdminButton>
            </div>
          </Form>
        </SectionCard>
        <aside className="admin-password-rules">
          <h2>Account access</h2>
          <p>
            <CheckCircleOutlined /> Admin uses email + password
          </p>
          <p>
            <CheckCircleOutlined /> Google login does not apply to Admin
          </p>
          <p>
            <CheckCircleOutlined /> Password recovery uses the registered email
          </p>
          <p>
            <CheckCircleOutlined /> After the change you sign in again on every device
          </p>
        </aside>
      </div>
    </AdminPage>
  );
};

export default ChangePassword;
