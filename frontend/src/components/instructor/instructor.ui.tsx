import { ArrowLeftOutlined, CheckOutlined, ExclamationCircleFilled } from "@ant-design/icons";
import { Button, type ButtonProps } from "antd";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import "./instructor.ui.scss";

export const InstructorPage = ({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) => <div className={`instructor-page ${className}`.trim()}>{children}</div>;

export const PageHeader = ({
  title,
  subtitle,
  actions,
  back,
  eyebrow,
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  back?: boolean;
  eyebrow?: string;
}) => {
  const navigate = useNavigate();
  return (
    <div className="instructor-page-header">
      <div className="instructor-page-heading">
        {back && (
          <Button
            className="instructor-back"
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(-1)}
          >
            Back
          </Button>
        )}
        {eyebrow && <span className="instructor-page-eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {actions && <div className="instructor-page-actions">{actions}</div>}
    </div>
  );
};

export const InstructorButton = (props: ButtonProps) => (
  <Button {...props} className={`instructor-button ${props.className || ""}`.trim()} />
);

export const SectionCard = ({
  title,
  extra,
  children,
  className = "",
}: {
  title?: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
  className?: string;
}) => (
  <section className={`instructor-section-card ${className}`.trim()}>
    {(title || extra) && (
      <div className="instructor-section-heading">
        <h2>{title}</h2>
        {extra}
      </div>
    )}
    {children}
  </section>
);

export const StatCard = ({
  label,
  value,
  note,
  tone = "neutral",
  to,
}: {
  label: string;
  value: ReactNode;
  note?: string;
  tone?: "neutral" | "success" | "warning" | "error";
  to?: { label: string; onClick: () => void };
}) => (
  <div className="instructor-stat-card">
    <span>{label}</span>
    <div>
      <strong>{value}</strong>
      {note && <small className={`instructor-tone-${tone}`}>{note}</small>}
    </div>
    {to && (
      <button type="button" className="instructor-stat-link" onClick={to.onClick}>
        {to.label}
      </button>
    )}
  </div>
);

export const StatusTag = ({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "error" | "info";
}) => <span className={`instructor-status instructor-status-${tone}`}>{children}</span>;

export const ProgressLine = ({
  value,
  tone = "amber",
}: {
  value: number;
  tone?: "navy" | "blue" | "amber" | "red";
}) => (
  <div className="instructor-progress-track">
    <span className={`instructor-progress-${tone}`} style={{ width: `${value}%` }} />
  </div>
);

export const WarningPanel = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <div className="instructor-warning">
    <ExclamationCircleFilled />
    <div>
      <strong>{title}</strong>
      <p>{children}</p>
    </div>
  </div>
);

export const InfoPanel = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <div className="instructor-info-panel">
    <strong>{title}</strong>
    <p>{children}</p>
  </div>
);

export const SuccessScreen = ({
  tone = "success",
  title,
  children,
  primary,
  secondary,
}: {
  tone?: "success" | "neutral" | "warning" | "error";
  title: string;
  children: ReactNode;
  primary?: { label: string; onClick: () => void };
  secondary?: { label: string; onClick: () => void };
}) => (
  <div className="instructor-success-card">
    <div className={`instructor-success-icon instructor-success-icon-${tone}`}>
      {tone === "error" || tone === "warning" ? (
        <ExclamationCircleFilled />
      ) : (
        <CheckOutlined />
      )}
    </div>
    <h2>{title}</h2>
    <div className="instructor-success-body">{children}</div>
    {(primary || secondary) && (
      <div className="instructor-success-actions">
        {primary && (
          <InstructorButton type="primary" onClick={primary.onClick}>
            {primary.label}
          </InstructorButton>
        )}
        {secondary && (
          <InstructorButton onClick={secondary.onClick}>{secondary.label}</InstructorButton>
        )}
      </div>
    )}
  </div>
);

export const DetailItem = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div className="instructor-detail-item">
    <span>{label}</span>
    <strong>{children}</strong>
  </div>
);
