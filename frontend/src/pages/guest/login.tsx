import { useState } from "react";
import { Alert, Button, Form, Input } from "antd";
import { BookOutlined, CheckOutlined, FlagOutlined } from "@ant-design/icons";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { loginAPI } from "@/services/identity.service";
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
  { icon: <BookOutlined />, text: "Build and approve courses" },
  { icon: <CheckOutlined />, text: "Assign required learning" },
  { icon: <FlagOutlined />, text: "Track completion and results" },
];

export default function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState(() => {
    const reason = params.get("reason");
    if (isSignInReason(reason)) return signInMessage(reason);
    return params.get("state") === "google"
      ? "This Google email is not linked to an existing LearnUP account."
      : params.get("state") === "credentials"
        ? "Check your email and password, then try again."
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
          <span>ORGANIZATIONAL TRAINING</span>
          <h2>
            Make learning
            <br />
            measurable for
            <br />
            every team.
          </h2>
          <p>
            Bring courses, assignments and progress into one clear workspace for
            your organization.
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
          LearnUP • Organization training management
        </small>
      </aside>

      <section className="login-panel">
        <Link className="login-back" to="/">
          ←&nbsp;&nbsp; Back to Home
        </Link>
        <div className="login-form">
          <span className="guest-eyebrow">WELCOME BACK</span>
          <h1>Sign in to LearnUP</h1>
          <p>Enter your account details to access your workspace.</p>
          {params.get("state") === "password-changed" && !error && (
            <Alert
              className="login-alert"
              type="success"
              message="Password changed"
              description="Sign in with your new password."
              role="status"
            />
          )}
          {error && (
            <Alert
              className="login-alert"
              type="error"
              message="Sign-in unsuccessful"
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
                ? { email: "alex.morgan@acme.example", password: "password" }
                : undefined
            }
            onFinish={submit}
            onValuesChange={() => setError("")}
            onFinishFailed={() =>
              setError("Check your email and password, then try again.")
            }
          >
            <Form.Item
              name="email"
              label="Email address"
              rules={[
                { required: true, message: "Enter your email address." },
                { type: "email", message: "Enter a valid email address." },
              ]}
            >
              <Input
                autoComplete="username"
                placeholder="alex.morgan@acme.example"
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
                label="Password"
                rules={[{ required: true, message: "Enter your password." }]}
              >
                <Input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
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
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  }
                />
              </Form.Item>
              <Link className="login-forgot" to="/forgot-password">
                Forgot password?
              </Link>
            </div>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              disabled={loading}
            >
              Sign in
            </Button>
          </Form>
          <div className="login-divider">or</div>
          <Button
            className="login-google"
            block
            disabled={loading}
            onClick={() =>
              setError(
                "Google sign-in is currently unavailable. Please sign in with your email and password.",
              )
            }
          >
            <span aria-hidden="true">G</span>Continue with Google
          </Button>
          <p className="login-help">
            Google sign-in is available for existing Organizer, Instructor and
            Learner accounts.
          </p>
        </div>
        <div className="login-panel-footer login-panel-footer-stacked">
          <div>
            <span>New organization?</span>
            <Link to="/register">Explore subscription plans →</Link>
          </div>
          <div>
            <span>Invited by your organization?</span>
            <Link to="/activate/demo-token">Activate your account →</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
