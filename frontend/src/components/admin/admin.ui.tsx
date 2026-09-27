import { ArrowLeftOutlined, ExclamationCircleFilled } from "@ant-design/icons";
import { Button, type ButtonProps } from "antd";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import "./admin.ui.scss";

export const AdminPage = ({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) => <div className={`admin-page ${className}`.trim()}>{children}</div>;

export const PageHeader = ({
  title,
  subtitle,
  actions,
  back,
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  back?: boolean;
}) => {
  const navigate = useNavigate();
  return (
    <div className="admin-page-header">
      <div className="admin-page-heading">
        {back && (
          <Button
            className="admin-back"
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(-1)}
          >
            Back
          </Button>
        )}
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {actions && <div className="admin-page-actions">{actions}</div>}
    </div>
  );
};

export const AdminButton = (props: ButtonProps) => (
  <Button
    {...props}
    className={`admin-button ${props.className || ""}`.trim()}
  />
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
  <section className={`admin-section-card ${className}`.trim()}>
    {(title || extra) && (
      <div className="admin-section-heading">
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
  <div className="admin-stat-card">
    <span>{label}</span>
    <div>
      <strong>{value}</strong>
      {note && <small className={`admin-tone-${tone}`}>{note}</small>}
    </div>
  </div>
);

export const StatusTag = ({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "error" | "info";
}) => <span className={`admin-status admin-status-${tone}`}>{children}</span>;

export const ProgressLine = ({
  label,
  value,
  count,
  tone = "navy",
}: {
  label: string;
  value: number;
  count?: ReactNode;
  tone?: "navy" | "blue" | "amber" | "red";
}) => (
  <div className="admin-progress">
    <div>
      <span>{label}</span>
      {count !== undefined && <strong>{count}</strong>}
    </div>
    <div className="admin-progress-track">
      <span
        className={`admin-progress-${tone}`}
        style={{ width: `${value}%` }}
      />
    </div>
  </div>
);

export const WarningPanel = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <div className="admin-warning">
    <ExclamationCircleFilled />
    <div>
      <strong>{title}</strong>
      <p>{children}</p>
    </div>
  </div>
);

export const DetailItem = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div className="admin-detail-item">
    <span>{label}</span>
    <strong>{children}</strong>
  </div>
);
