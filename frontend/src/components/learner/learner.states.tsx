import { ExclamationCircleOutlined, InboxOutlined } from "@ant-design/icons";
import { Button, Skeleton } from "antd";
import type { ReactNode } from "react";

import { isRetryableError, type ApiError } from "@/types/api.types";
import "./learner.states.scss";

const GENERIC_LOAD_ERROR = "Không tải được dữ liệu. Vui lòng thử lại.";

export const LearnerSkeleton = ({ variant }: { variant: "list" | "grid" | "detail" }) => (
  <div className={`learner-skeleton learner-skeleton-${variant}`} role="status" aria-busy="true" aria-label="Đang tải">
    {variant === "list" &&
      Array.from({ length: 4 }, (_, index) => (
        <div className="learner-skeleton-row" key={index}>
          <Skeleton.Node active className="learner-skeleton-thumb">
            <span />
          </Skeleton.Node>
          <Skeleton active title={{ width: "40%" }} paragraph={{ rows: 2, width: ["70%", "30%"] }} />
        </div>
      ))}
    {variant === "grid" &&
      Array.from({ length: 6 }, (_, index) => (
        <div className="learner-skeleton-card" key={index}>
          <Skeleton.Node active className="learner-skeleton-cover">
            <span />
          </Skeleton.Node>
          <Skeleton active title={{ width: "80%" }} paragraph={{ rows: 2, width: ["100%", "50%"] }} />
        </div>
      ))}
    {variant === "detail" && (
      <>
        <Skeleton active title={{ width: "50%" }} paragraph={{ rows: 2, width: ["80%", "40%"] }} />
        <Skeleton active title={false} paragraph={{ rows: 6 }} />
      </>
    )}
  </div>
);

/**
 * Lỗi tải dữ liệu. Nút "Thử lại" chỉ hiện với lỗi mạng, timeout, 502–504 (D45).
 * Không hiện nguyên văn message của server: lỗi mạng/5xx dùng thông báo chung, còn lại dùng `message`.
 */
export const LearnerErrorState = ({
  error,
  title = "Đã có lỗi xảy ra",
  message,
  onRetry,
}: {
  error: ApiError;
  title?: string;
  message?: string;
  onRetry?: () => void;
}) => {
  const isUnavailable = error.status === 0 || error.status >= 500;
  const text = isUnavailable ? GENERIC_LOAD_ERROR : (message ?? GENERIC_LOAD_ERROR);

  return (
    <div className="learner-state learner-state-error" role="alert">
      <ExclamationCircleOutlined className="learner-state-icon" aria-hidden="true" />
      <h2>{title}</h2>
      <p>{text}</p>
      {onRetry && isRetryableError(error) && (
        <Button className="learner-state-action" onClick={onRetry}>
          Thử lại
        </Button>
      )}
    </div>
  );
};

export const LearnerEmptyState = ({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) => (
  <div className="learner-state learner-state-empty">
    <InboxOutlined className="learner-state-icon" aria-hidden="true" />
    <h2>{title}</h2>
    {description && <p>{description}</p>}
    {action && <div className="learner-state-action">{action}</div>}
  </div>
);
