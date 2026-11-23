import { useRef, useState } from "react";
import { Button, Form, Input } from "antd";
import { Link } from "react-router-dom";
import { AuthCard } from "@/components/guest/auth";
import { resendRegistrationEmailAPI } from "@/services/organization.service";
import { normalizeEmail } from "@/utils/helper";
import { VietnameseAlert } from "@/components/vietnamese.controls";

type ResendFields = { email: string };

export default function RegistrationResendPage() {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);

  async function submit(values: ResendFields) {
    if (pending.current) return;
    pending.current = true;
    setSubmitting(true);
    setSent(false);
    setError(null);
    try {
      const res = await resendRegistrationEmailAPI(
        normalizeEmail(values.email),
      );
      if (res.data) {
        setSent(true);
      } else {
        setError("Hiện chưa gửi được thư đăng ký. Vui lòng thử lại sau.");
      }
    } catch {
      setError("Không kết nối được với máy chủ. Vui lòng thử lại sau.");
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  }

  return (
    <AuthCard>
      <h1>Gửi lại thư đăng ký</h1>
      <p>
        Nhập email bạn đã dùng để đăng ký tổ chức.
        <br />
        Nếu đăng ký vẫn đang chờ thanh toán, chúng tôi sẽ gửi liên kết mới, kèm
        mã xác thực mới nếu email của bạn chưa được xác thực.
      </p>
      {error && <VietnameseAlert type="error" showIcon message={error} role="alert" />}
      <Form<ResendFields>
        layout="vertical"
        requiredMark={false}
        disabled={submitting}
        onFinish={submit}
        onValuesChange={() => {
          setSent(false);
          setError(null);
        }}
      >
        <Form.Item
          label="Địa chỉ email"
          name="email"
          rules={[
            { required: true, message: "Hãy nhập địa chỉ email." },
            {
              type: "email",
              transform: (value: string) => value?.trim(),
              message: "Địa chỉ email không hợp lệ.",
            },
          ]}
        >
          <Input autoComplete="email" placeholder="nguyen.van.an@example.com" />
        </Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          block
          loading={submitting}
          disabled={submitting}
        >
          Gửi lại thư
        </Button>
      </Form>
      {sent && (
        <div className="auth-confirmation" role="status">
          <b>Đã nhận yêu cầu</b>
          <p>
            Nếu email này thuộc một đăng ký đang chờ thanh toán, thư mới đang
            được gửi tới bạn. Liên kết và mã trước đó không còn dùng được. Hãy
            kiểm tra hộp thư đến và thư mục thư rác.
          </p>
        </div>
      )}
      <Link className="auth-link" to="/forgot-password">
        Đã thanh toán? Hãy đặt lại mật khẩu
      </Link>
      <br />
      <Link className="auth-link" to="/login">
        Quay lại đăng nhập
      </Link>
    </AuthCard>
  );
}
