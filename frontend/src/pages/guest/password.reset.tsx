import { useEffect, useRef, useState } from "react";
import { CheckOutlined } from "@ant-design/icons";
import { Button, Form } from "antd";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AuthCard, AuthResult } from "@/components/guest/auth";
import { confirmPasswordRules } from "@/hooks/use.change.password";
import { resetPasswordAPI } from "@/services/identity.service";
import { hasMinimumPasswordLength, isWithinPasswordByteLimit } from "@/utils/password.policy";
import { VietnameseAlert, VietnamesePassword } from "@/components/vietnamese.controls";

type ResetPasswordFields = { password: string; confirm: string };

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const [form] = Form.useForm<ResetPasswordFields>();
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const currentToken = useRef(token);
  currentToken.current = token;
  const invalidLink = "Liên kết đặt lại mật khẩu không hợp lệ, đã hết hạn hoặc không còn dùng được. Hãy yêu cầu liên kết mới.";

  useEffect(() => {
    // Also cover client-side entry. Initial hard loads are protected before CSS
    // requests by the reset-only head guard in index.html.
    const existing = document.querySelector<HTMLMetaElement>('meta[name="referrer"]');
    const policy = existing ?? document.createElement("meta");
    const previous = existing?.content;
    const recoveryPolicy = existing?.id === "password-recovery-referrer";
    policy.name = "referrer";
    policy.content = "no-referrer";
    if (!existing) document.head.appendChild(policy);
    return () => {
      if (previous === undefined || recoveryPolicy) policy.remove();
      else policy.content = previous;
    };
  }, []);

  useEffect(() => {
    setDone(false);
    setError(null);
    form.resetFields();
  }, [token, form]);

  async function submit(values: ResetPasswordFields) {
    if (pending.current || done) return;
    if (!token?.trim()) {
      setError(invalidLink);
      return;
    }
    pending.current = true;
    setSubmitting(true);
    setError(null);
    const submittedToken = token;
    try {
      const result = await resetPasswordAPI({
        token,
        newPassword: values.password,
        confirmPassword: values.confirm,
      });
      if (currentToken.current !== submittedToken) return;
      if (result.success) {
        form.resetFields();
        setDone(true);
      } else {
        setError(result.error === "invalid-token" ? invalidLink
          : "Hiện chưa đặt lại được mật khẩu. Vui lòng thử lại sau.");
      }
    } catch {
      if (currentToken.current === submittedToken) {
        setError("Hiện chưa đặt lại được mật khẩu. Vui lòng thử lại sau.");
      }
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <AuthCard>
        <AuthResult
          icon={<CheckOutlined aria-hidden="true" />}
          tone="success"
          title="Đã đặt lại mật khẩu"
          action={
            <Button type="primary" onClick={() => navigate("/login", { replace: true })}>
              Tiếp tục đăng nhập
            </Button>
          }
        >
          <p>Mật khẩu của bạn đã được cập nhật. Hãy đăng nhập bằng mật khẩu mới.</p>
        </AuthResult>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <h1>Đặt mật khẩu mới</h1>
      <p>Dùng liên kết khôi phục đã gửi tới email đăng ký của bạn.</p>
      {(error || !token?.trim()) && (
        <VietnameseAlert type="error" showIcon message={error ?? invalidLink} role="alert" />
      )}
      <Form<ResetPasswordFields>
        layout="vertical"
        requiredMark={false}
        form={form}
        disabled={submitting || !token?.trim()}
        onFinish={submit}
        onValuesChange={() => setError(null)}
      >
        <Form.Item
          label="Mật khẩu mới"
          name="password"
          rules={[
            { required: true, whitespace: true, message: "Hãy nhập mật khẩu mới." },
            {
              validator(_, value?: string) {
                // Identity stores the trimmed password, so the minimum applies to it.
                return !value || hasMinimumPasswordLength(value, 6)
                  ? Promise.resolve()
                  : Promise.reject(new Error("Mật khẩu cần ít nhất 6 ký tự."));
              },
            },
            {
              validator(_, value?: string) {
                // BCrypt's existing backend limit is bytes, not Unicode characters.
                return !value || isWithinPasswordByteLimit(value)
                  ? Promise.resolve()
                  : Promise.reject(new Error("Mật khẩu quá dài. Hãy dùng ít ký tự hơn."));
              },
            },
          ]}
        >
          <VietnamesePassword autoComplete="new-password" placeholder="Nhập mật khẩu mới" />
        </Form.Item>
        <Form.Item
          label="Nhập lại mật khẩu mới"
          name="confirm"
          dependencies={["password"]}
          rules={confirmPasswordRules}
        >
          <VietnamesePassword autoComplete="new-password" placeholder="Nhập lại mật khẩu mới" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={submitting} disabled={submitting || !token?.trim()}>
          Đặt lại mật khẩu
        </Button>
      </Form>
      <Link className="auth-link" to="/forgot-password">
        Yêu cầu liên kết mới
      </Link>
      <br />
      <Link className="auth-link" to="/login">
        Quay lại đăng nhập
      </Link>
    </AuthCard>
  );
}
