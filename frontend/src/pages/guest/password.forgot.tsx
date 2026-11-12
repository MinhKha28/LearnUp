import { useRef, useState } from "react";
import { Alert, Button, Form, Input } from "antd";
import { Link } from "react-router-dom";
import { AuthCard } from "@/components/guest/auth";
import { forgotPasswordAPI } from "@/services/identity.service";

type ForgotPasswordFields = { email: string };

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);

  async function submit(values: ForgotPasswordFields) {
    if (pending.current) return;
    pending.current = true;
    setSubmitting(true);
    setSent(false);
    setError(null);
    try {
      const result = await forgotPasswordAPI({ email: values.email.trim() });
      if (result.success) {
        setSent(true);
      } else {
        setError("Hiện chưa gửi được yêu cầu khôi phục mật khẩu. Vui lòng thử lại sau.");
      }
    } catch {
      setError("Hiện chưa gửi được yêu cầu khôi phục mật khẩu. Vui lòng thử lại sau.");
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  }

  return (
    <AuthCard>
      <h1>Đặt lại mật khẩu</h1>
      <p>
        Nhập địa chỉ email của tài khoản.
        <br />
        Nếu tài khoản đủ điều kiện, chúng tôi sẽ gửi hướng dẫn khôi phục mật khẩu.
      </p>
      {error && <Alert type="error" showIcon message={error} role="alert" />}
      <Form<ForgotPasswordFields>
        layout="vertical"
        requiredMark={false}
        disabled={submitting}
        onFinish={submit}
        onValuesChange={() => { setSent(false); setError(null); }}
      >
        <Form.Item
          label="Địa chỉ email"
          name="email"
          rules={[
            { required: true, message: "Hãy nhập địa chỉ email." },
            { type: "email", message: "Địa chỉ email không hợp lệ." },
          ]}
        >
          <Input autoComplete="email" placeholder="nguyen.van.an@congty.vn" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={submitting} disabled={submitting}>
          Gửi liên kết đặt lại
        </Button>
      </Form>
      {sent && (
        <div className="auth-confirmation" role="status">
          <b>Đã nhận yêu cầu</b>
          <p>
            Nếu email này đủ điều kiện khôi phục, chúng tôi sẽ gửi hướng dẫn. Hãy
            kiểm tra hộp thư đến và thư mục thư rác; thư có thể đến chậm.
          </p>
        </div>
      )}
      <Link className="auth-link" to="/login">
        Đã có quyền truy cập? Đăng nhập
      </Link>
    </AuthCard>
  );
}
