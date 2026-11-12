import { useState } from "react";
import { Alert, Button, Form, Input } from "antd";
import { BookOutlined, CheckOutlined, FlagOutlined } from "@ant-design/icons";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { googleLoginAPI, loginAPI } from "@/services/identity.service";
import GoogleSignIn from "@/components/guest/google.sign.in";
import { googleSignInMessage } from "@/utils/google.sign.in";
import { loadUserWithProfile } from "@/services/profile.service";
import { useCurrentApp } from "@/components/context/app.context";
import "@/pages/guest/login.scss";
import {
  homePathForRole,
  isSignInReason,
  safeRedirect,
  saveTokens,
  signInMessage,
} from "@/utils/auth";

type LoginFields = { email: string; password: string };

const workspace = [
  { icon: <BookOutlined />, text: "Xây dựng và phê duyệt khóa học" },
  { icon: <CheckOutlined />, text: "Phân công đào tạo bắt buộc" },
  { icon: <FlagOutlined />, text: "Theo dõi mức hoàn thành và kết quả" },
];

export default function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState(() => {
    const reason = params.get("reason");
    if (isSignInReason(reason)) return signInMessage(reason);
    return params.get("state") === "google"
      ? "Email Google này chưa gắn với tài khoản LearnUP nào."
      : params.get("state") === "credentials"
        ? "Hãy kiểm tra email và mật khẩu rồi thử lại."
        : "";
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { setUser, setIsAuthenticated } = useCurrentApp();

  async function submit(values: LoginFields) {
    setLoading(true);
    setError("");
    try {
      const response = await loginAPI(values.email, values.password);
      const result = response.data;
      if (result?.accessToken && result.refreshToken && result.user) {
        saveTokens(result.accessToken, result.refreshToken);
        setUser(await loadUserWithProfile(result.user));
        setIsAuthenticated(true);
        navigate(
          safeRedirect(params.get("redirect")) ??
            homePathForRole(result.user.role),
          { replace: true },
        );
        return;
      }
      const code = (response as unknown as { error?: { code?: string } })
        .error?.code;
      setError(signInMessage(code));
    } catch {
      setError("Hiện chưa đăng nhập được. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  // UC05.1: existing Organizer/Instructor/Learner accounts only; Identity never creates an account.
  async function googleSubmit(credential: string) {
    setLoading(true);
    setError("");
    try {
      const response = await googleLoginAPI(credential);
      const result = response.data;
      if (result?.accessToken && result.refreshToken && result.user) {
        saveTokens(result.accessToken, result.refreshToken);
        setUser(await loadUserWithProfile(result.user));
        setIsAuthenticated(true);
        navigate(
          safeRedirect(params.get("redirect")) ??
            homePathForRole(result.user.role),
          { replace: true },
        );
        return;
      }
      const code = (response as unknown as { error?: { code?: string } })
        .error?.code;
      setError(googleSignInMessage(code));
    } catch {
      setError("Unable to sign in right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login" id="guest-main">
      <aside className="login-brand">
        <Link to="/" className="login-logo">
          <img src="/logo/learnup-logo-light.png" alt="LearnUP" />
        </Link>
        <div className="login-brand-content">
          <span>Đào tạo trong tổ chức</span>
          <h2>
            Đo lường được
            <br />
            việc học của
            <br />
            mọi nhóm.
          </h2>
          <p>
            Đưa khóa học, phân công đào tạo và tiến độ vào một không gian làm
            việc rõ ràng cho tổ chức của bạn.
          </p>
          <div className="login-workspace">
            {workspace.map((item) => (
              <div className="login-workspace-row" key={item.text}>
                <span>{item.icon}</span>
                <b>{item.text}</b>
              </div>
            ))}
          </div>
        </div>
        <small className="login-brand-footer">
          LearnUP • Quản lý đào tạo cho tổ chức
        </small>
      </aside>

      <section className="login-panel">
        <Link className="login-back" to="/">
          ←&nbsp;&nbsp; Về trang chủ
        </Link>
        <div className="login-form">
          <span className="guest-eyebrow">Chào mừng trở lại</span>
          <h1>Đăng nhập LearnUP</h1>
          <p>Nhập thông tin tài khoản để vào không gian làm việc.</p>
          {params.get("state") === "password-changed" && !error && (
            <Alert
              className="login-alert"
              type="success"
              message="Đã đổi mật khẩu"
              description="Hãy đăng nhập bằng mật khẩu mới."
              role="status"
            />
          )}
          {params.get("state") === "signed-out-unconfirmed" && !error && (
            <Alert
              className="login-alert"
              type="warning"
              message="Signed out on this device"
              description="LearnUP could not confirm that your session ended on the server. Sign in again and sign out once you are back online."
              role="status"
            />
          )}
          {error && (
            <Alert
              className="login-alert"
              type="error"
              message="Đăng nhập không thành công"
              description={error}
              role="alert"
            />
          )}
          <Form<LoginFields>
            layout="vertical"
            requiredMark={false}
            disabled={loading}
            initialValues={
              params.get("state") === "credentials"
                ? { email: "nguyen.van.an@example.com", password: "password" }
                : undefined
            }
            onFinish={submit}
            onValuesChange={() => setError("")}
            onFinishFailed={() =>
              setError("Hãy kiểm tra email và mật khẩu rồi thử lại.")
            }
          >
            <Form.Item
              name="email"
              label="Địa chỉ email"
              rules={[
                { required: true, message: "Hãy nhập địa chỉ email." },
                { type: "email", message: "Địa chỉ email không hợp lệ." },
              ]}
            >
              <Input
                autoComplete="username"
                placeholder="nguyen.van.an@example.com"
                status={
                  error && params.get("state") !== "google"
                    ? "error"
                    : undefined
                }
              />
            </Form.Item>
            <div className="login-password">
              <Form.Item
                name="password"
                label="Mật khẩu"
                rules={[{ required: true, message: "Hãy nhập mật khẩu." }]}
              >
                <Input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Nhập mật khẩu"
                  status={
                    error && params.get("state") !== "google"
                      ? "error"
                      : undefined
                  }
                  suffix={
                    <button
                      type="button"
                      className="login-show"
                      disabled={loading}
                      onClick={() => setShowPassword((value) => !value)}
                    >
                      {showPassword ? "Ẩn" : "Hiện"}
                    </button>
                  }
                />
              </Form.Item>
              <Link className="login-forgot" to="/forgot-password">
                Quên mật khẩu?
              </Link>
            </div>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              disabled={loading}
            >
              Đăng nhập
            </Button>
          </Form>
          <div className="login-divider">hoặc</div>
          <GoogleSignIn
            disabled={loading}
            onCredential={googleSubmit}
            onError={setError}
          />
          <p className="login-help">
            Tài khoản quản lý đào tạo, giảng viên và học viên đã có có thể đăng
            nhập bằng Google.
          </p>
        </div>
        <div className="login-panel-footer login-panel-footer-stacked">
          <div>
            <span>Tổ chức mới?</span>
            <Link to="/register">Xem các gói →</Link>
          </div>
          <div>
            <span>Chưa hoàn tất đăng ký?</span>
            <Link to="/resend-registration">Gửi lại thư đăng ký →</Link>
          </div>
          <div>
            <span>Được tổ chức mời?</span>
            <Link to="/activate/demo-token">Kích hoạt tài khoản →</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
