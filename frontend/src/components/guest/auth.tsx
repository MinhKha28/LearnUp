import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import "./auth.scss";

// Shared visual shell for the standalone Guest auth screens (Invitation Activation,
// Invitation Link Error, Activation Success, Forgot Password, Reset Password).
// These screens intentionally render without the marketing Header/Footer chrome
// (see components/layout/header.tsx and footer.tsx, which opt out for these routes).

export const AuthCard = ({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) => (
  <main className="auth-page" id="guest-main">
    <Link className="auth-page-logo" to="/" aria-label="LearnUP home">
      <img src="/logo/learnup-logo-dark.png" alt="LearnUP" />
    </Link>
    <section className={`auth-card ${className}`.trim()}>{children}</section>
  </main>
);

export const AuthResult = ({
  icon,
  tone = "warning",
  title,
  children,
  action,
}: {
  icon: ReactNode;
  tone?: "warning" | "success";
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) => (
  <div className="auth-result">
    <div className={`auth-result-icon auth-result-icon-${tone}`}>{icon}</div>
    <h1>{title}</h1>
    <div className="auth-result-body">{children}</div>
    {action && <div className="auth-result-action">{action}</div>}
  </div>
);
