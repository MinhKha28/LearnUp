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
        eyebrow="Tài khoản / Mật khẩu"
        title="Đổi mật khẩu"
        subtitle="Xác minh mật khẩu hiện tại trước khi đặt mật khẩu mới."
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
            label="Mật khẩu hiện tại"
            name="current"
            rules={currentPasswordRules}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            label="Mật khẩu mới"
            name="password"
            dependencies={["current"]}
            rules={newPasswordRules}
          >
            <Input.Password placeholder="Nhập mật khẩu mới" />
          </Form.Item>
          <Form.Item
            label="Nhập lại mật khẩu mới"
            name="confirm"
            dependencies={["password"]}
            rules={confirmPasswordRules}
          >
            <Input.Password placeholder="Nhập lại mật khẩu mới" />
          </Form.Item>
          <div className="learner-password-actions">
            <LearnerButton type="primary" htmlType="submit" loading={submitting}>
              Cập nhật mật khẩu
            </LearnerButton>
          </div>
        </Form>
      </SectionCard>
    </LearnerPage>
  );
};

export default ChangePassword;
