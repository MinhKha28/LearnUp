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
        title="Đổi mật khẩu"
        subtitle="Xác minh mật khẩu hiện tại trước khi đặt mật khẩu mới."
        back
      />
      <div className="organizer-password-grid">
        <SectionCard title="Thiết lập mật khẩu">
          {error && <Alert type="error" showIcon message={error} role="alert" />}
          <Form<ChangePasswordFields>
            className="organizer-form"
            layout="vertical"
            disabled={submitting}
            onFinish={submit}
            onValuesChange={clearError}
          >
            <Form.Item label="Mật khẩu hiện tại" name="current" rules={currentPasswordRules}>
              <Input.Password />
            </Form.Item>
            <Form.Item label="Mật khẩu mới" name="password" dependencies={["current"]} rules={newPasswordRules}>
              <Input.Password />
            </Form.Item>
            <Form.Item
              label="Nhập lại mật khẩu mới"
              name="confirm"
              dependencies={["password"]}
              rules={confirmPasswordRules}
            >
              <Input.Password />
            </Form.Item>
            <div className="organizer-form-actions">
              <OrganizerButton onClick={() => navigate(-1)}>Hủy</OrganizerButton>
              <OrganizerButton type="primary" htmlType="submit" loading={submitting}>
                Cập nhật mật khẩu
              </OrganizerButton>
            </div>
          </Form>
        </SectionCard>
        <aside className="organizer-password-rules">
          <h2>Truy cập tài khoản</h2>
          <p>
            <CheckCircleOutlined aria-hidden="true" /> Quản lý đào tạo đăng nhập bằng email và mật khẩu
          </p>
          <p>
            <CheckCircleOutlined aria-hidden="true" /> Có thể đăng nhập bằng Google nếu email Google trùng email tài khoản
          </p>
          <p>
            <CheckCircleOutlined aria-hidden="true" /> Khôi phục mật khẩu qua email đã đăng ký
          </p>
          <p>
            <CheckCircleOutlined aria-hidden="true" /> Sau khi đổi, bạn cần đăng nhập lại trên mọi thiết bị
          </p>
        </aside>
      </div>
    </OrganizerPage>
  );
};

export default ChangePassword;
