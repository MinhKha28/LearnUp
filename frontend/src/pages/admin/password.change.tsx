import { VietnameseAlert, VietnamesePassword } from "@/components/vietnamese.controls";
import { CheckCircleOutlined } from "@ant-design/icons";
import { Form } from "antd";
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
      <PageHeader title="Đổi mật khẩu" subtitle="Xác minh mật khẩu hiện tại trước khi đặt mật khẩu mới." />
      <div className="admin-password-grid">
        <SectionCard title="Thiết lập mật khẩu">
          {error && <VietnameseAlert type="error" showIcon message={error} role="alert" />}
          <Form<ChangePasswordFields>
            className="admin-form"
            layout="vertical"
            disabled={submitting}
            onFinish={submit}
            onValuesChange={clearError}
          >
            <Form.Item label="Mật khẩu hiện tại" name="current" rules={currentPasswordRules}>
              <VietnamesePassword autoComplete="current-password" />
            </Form.Item>
            <Form.Item label="Mật khẩu mới" name="password" dependencies={["current"]} rules={newPasswordRules}>
              <VietnamesePassword autoComplete="new-password" />
            </Form.Item>
            <Form.Item label="Nhập lại mật khẩu mới" name="confirm" dependencies={["password"]} rules={confirmPasswordRules}>
              <VietnamesePassword autoComplete="new-password" />
            </Form.Item>
            <div className="admin-form-actions">
              <AdminButton onClick={() => navigate(-1)}>Hủy</AdminButton>
              <AdminButton type="primary" htmlType="submit" loading={submitting}>
                Cập nhật mật khẩu
              </AdminButton>
            </div>
          </Form>
        </SectionCard>
        <aside className="admin-password-rules">
          <h2>Truy cập tài khoản</h2>
          <p>
            <CheckCircleOutlined aria-hidden="true" /> Quản trị viên đăng nhập bằng email và mật khẩu
          </p>
          <p>
            <CheckCircleOutlined aria-hidden="true" /> Quản trị viên không đăng nhập được bằng Google
          </p>
          <p>
            <CheckCircleOutlined aria-hidden="true" /> Khôi phục mật khẩu qua email đã đăng ký
          </p>
          <p>
            <CheckCircleOutlined aria-hidden="true" /> Sau khi đổi, bạn cần đăng nhập lại trên mọi thiết bị
          </p>
        </aside>
      </div>
    </AdminPage>
  );
};

export default ChangePassword;
