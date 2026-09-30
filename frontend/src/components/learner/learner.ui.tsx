import { ArrowLeftOutlined, CheckOutlined, ExclamationCircleFilled } from "@ant-design/icons";
import { Button, type ButtonProps } from "antd";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import "./learner.ui.scss";

export const LearnerPage = ({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) => <div className={`learner-page ${className}`.trim()}>{children}</div>;

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
    <div className="learner-page-header">
      <div className="learner-page-heading">
        {back && (
          <Button
            className="learner-back"
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(-1)}
          >
            Back
          </Button>
        )}
        {eyebrow && <span className="learner-page-eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {actions && <div className="learner-page-actions">{actions}</div>}
    </div>
  );
};

export const LearnerButton = (props: ButtonProps) => (
  <Button {...props} className={`learner-button ${props.className || ""}`.trim()} />
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
  <section className={`learner-section-card ${className}`.trim()}>
    {(title || extra) && (
      <div className="learner-section-heading">
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
}: {
  label: string;
  value: ReactNode;
  note?: string;
  tone?: "neutral" | "success" | "warning" | "error";
}) => (
  <div className="learner-stat-card">
    <span>{label}</span>
    <div>
      <strong>{value}</strong>
      {note && <small className={`learner-tone-${tone}`}>{note}</small>}
    </div>
  </div>
);

export const StatusTag = ({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "error" | "info";
}) => <span className={`learner-status learner-status-${tone}`}>{children}</span>;

export const ProgressLine = ({
  value,
  tone = "amber",
}: {
  value: number;
  tone?: "navy" | "blue" | "amber" | "red";
}) => (
  <div className="learner-progress-track">
    <span className={`learner-progress-${tone}`} style={{ width: `${value}%` }} />
  </div>
);

export const WarningPanel = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <div className="learner-warning">
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
  <div className="learner-info-panel">
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
  tone?: "success" | "neutral" | "error";
  title: string;
  children: ReactNode;
  primary?: { label: string; onClick: () => void };
  secondary?: { label: string; onClick: () => void };
}) => (
  <div className="learner-success-card">
    <div className={`learner-success-icon learner-success-icon-${tone}`}>
      {tone === "error" ? <ExclamationCircleFilled /> : <CheckOutlined />}
    </div>
    <h2>{title}</h2>
    <div className="learner-success-body">{children}</div>
    {(primary || secondary) && (
      <div className="learner-success-actions">
        {primary && (
          <LearnerButton type="primary" onClick={primary.onClick}>
            {primary.label}
          </LearnerButton>
        )}
        {secondary && (
          <LearnerButton onClick={secondary.onClick}>{secondary.label}</LearnerButton>
        )}
      </div>
    )}
  </div>
);

export const CourseIconTile = () => (
  <div className="learner-course-icon">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="#1e293b" strokeWidth="1.4" />
      <line x1="6" y1="8" x2="18" y2="8" stroke="#1e293b" strokeWidth="1.4" />
      <line x1="6" y1="12" x2="18" y2="12" stroke="#1e293b" strokeWidth="1.4" />
      <line x1="6" y1="16" x2="14" y2="16" stroke="#1e293b" strokeWidth="1.4" />
    </svg>
  </div>
);

export const CourseListItem = ({
  title,
  pills,
  meta,
  progress,
  actionLabel = "Continue",
  to,
  secondary,
}: {
  title: string;
  pills: { label: string; tone: "neutral" | "success" | "warning" | "error" | "info" }[];
  meta?: string;
  progress: number;
  actionLabel?: string;
  to?: string;
  secondary?: { label: string; onClick: () => void };
}) => {
  const navigate = useNavigate();
  return (
    <div className="learner-course-item">
      <CourseIconTile />
      <div className="learner-course-body">
        <strong>{title}</strong>
        <div className="learner-course-pills">
          {pills.map((pill) => (
            <StatusTag key={pill.label} tone={pill.tone}>
              {pill.label}
            </StatusTag>
          ))}
        </div>
      </div>
      {meta && <span className="learner-course-meta">{meta}</span>}
      <div className="learner-course-progress">
        <div className="learner-progress-track">
          <span className="learner-progress-amber" style={{ width: `${progress}%` }} />
        </div>
        <span>{progress}%</span>
      </div>
      <div className="learner-course-actions">
        {secondary && (
          <Button type="text" className="learner-course-secondary" onClick={secondary.onClick}>
            {secondary.label}
          </Button>
        )}
        <LearnerButton onClick={() => to && navigate(to)}>{actionLabel}</LearnerButton>
      </div>
    </div>
  );
};

export const DetailItem = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div className="learner-detail-item">
    <span>{label}</span>
    <strong>{children}</strong>
  </div>
);
