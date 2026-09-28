import type { ReactNode } from "react";
import { Button } from "antd";
import { Link } from "react-router-dom";
import "./error.page.scss";

export type ErrorTone = "amber" | "blue" | "red";

interface IErrorAction {
  label: string;
  icon: ReactNode;
  onClick: () => void;
}

interface IErrorPageProps {
  tone: ErrorTone;
  badgeLabel: string;
  headerRight: ReactNode;
  title: ReactNode;
  description: ReactNode;
  primaryAction: IErrorAction;
  secondaryAction: IErrorAction;
  footnote: string;
  errorCode: string;
  illustration: ReactNode;
}

const ErrorPage = ({
  tone,
  badgeLabel,
  headerRight,
  title,
  description,
  primaryAction,
  secondaryAction,
  footnote,
  errorCode,
  illustration,
}: IErrorPageProps) => {
  return (
    <div className="error-page">
      <header className="error-page-header">
        <Link className="error-page-logo" to="/" aria-label="LearnUP home">
          <img src="/logo/learnup-logo-dark.png" alt="LearnUP" />
        </Link>
        <div className="error-page-header-right">{headerRight}</div>
      </header>
      <main className="error-page-main">
        <div className="error-page-card">
          <div className="error-page-content">
            <span className={`error-page-badge error-page-badge-${tone}`}>{badgeLabel}</span>
            <h1>{title}</h1>
            <p className="error-page-description">{description}</p>
            <div className="error-page-actions">
              <Button type="primary" icon={primaryAction.icon} onClick={primaryAction.onClick}>
                {primaryAction.label}
              </Button>
              <Button icon={secondaryAction.icon} onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </Button>
            </div>
            <div className="error-page-divider" />
            <p className="error-page-footnote">{footnote}</p>
            <p className="error-page-code">{errorCode}</p>
          </div>
          <div className={`error-page-illustration error-page-illustration-${tone}`}>
            {illustration}
          </div>
        </div>
      </main>
      <footer className="error-page-footer">
        <span>© {new Date().getFullYear()} LearnUP</span>
        <span>Organization training management</span>
      </footer>
    </div>
  );
};

export default ErrorPage;
