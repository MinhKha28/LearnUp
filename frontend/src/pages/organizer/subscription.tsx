import { subscriptionStatusViewVi } from "@/utils/organization.detail.view";
import { formatNumberVN } from "@/utils/number.format";
import { useEffect, useState, type ReactNode } from "react";
import { Spin } from "antd";
import {
  BookOutlined,
  CloudOutlined,
  SolutionOutlined,
  TeamOutlined,
  WarningFilled,
} from "@ant-design/icons";
import { Link } from "react-router-dom";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
} from "@/components/organizer/organizer.ui";
import { getCurrentSubscriptionAPI } from "@/services/subscription.service";
import type {
  ISubscriptionOverview,
  IUsageItem,
  SubscriptionStatus,
} from "@/types/subscription.types";
import { formatDateVN, formatVnd } from "@/utils/helper";
import "./subscription.scss";
import { VietnameseAlert } from "@/components/vietnamese.controls";

const DAY_MS = 24 * 60 * 60 * 1000;

const formatDate = (value?: string | null) =>
  value ? formatDateVN(value) : "-";

const formatBytes = (bytes: number) => {
  if (bytes >= 1024 ** 3) return `${formatNumberVN(bytes / 1024 ** 3, 1)} GB`;
  if (bytes >= 1024 ** 2) return `${formatNumberVN(bytes / 1024 ** 2, 1)} MB`;
  return `${formatNumberVN(bytes / 1024, 1)} KB`;
};

const STATUS_VIEW: Record<
  SubscriptionStatus,
  { tone: string; access: string }
> = {
  Active: {
    tone: "active",
    access: "Toàn quyền truy cập",
  },
  Grace: {
    tone: "grace",
    access: "Truy cập có giới hạn",
  },
  Suspended: { tone: "suspended", access: "Chỉ xem" },
};

const usageLevel = (item: IUsageItem) =>
  (item.percent ?? 0) >= 100 ? "full" : item.warning ? "warning" : "ok";

const UsageCard = ({
  icon,
  label,
  item,
  format = (value: number) => value.toLocaleString("vi-VN"),
}: {
  icon: ReactNode;
  label: string;
  item: IUsageItem;
  format?: (value: number) => string;
}) => {
  const level = usageLevel(item);
  return (
    <div className={`sub-usage-card sub-usage-${level}`}>
      <div className="sub-usage-head">
        <span className="sub-usage-icon">{icon}</span>
        <span className="sub-usage-label">{label}</span>
        {level !== "ok" && <WarningFilled role="img" aria-label={level === "full" ? "Đã chạm giới hạn sử dụng" : "Sắp chạm giới hạn sử dụng"} className="sub-usage-alert" />}
      </div>
      {item.used === null ? (
        <>
          <strong className="sub-usage-value">-</strong>
          <small className="sub-usage-caption">Hiện chưa lấy được</small>
        </>
      ) : (
        <>
          <strong className="sub-usage-value">
            {format(item.used)}
            <span> / {format(item.limit)}</span>
          </strong>
          <div className="sub-usage-bar">
            <span style={{ width: `${Math.min(item.percent ?? 0, 100)}%` }} />
          </div>
          <small className="sub-usage-caption">
            Đã dùng {item.percent?.toLocaleString("vi-VN")}%
            {level === "full"
              ? " - đã đạt giới hạn"
              : level === "warning"
                ? " - sắp đạt giới hạn"
                : ""}
          </small>
        </>
      )}
    </div>
  );
};

const Subscription = () => {
  const [overview, setOverview] = useState<ISubscriptionOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await getCurrentSubscriptionAPI();
        if (!active) return;
        if (res.data) setOverview(res.data);
        else setError("Không tải được gói dịch vụ.");
      } catch {
        if (active) setError("Không kết nối được với máy chủ.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const subscription = overview?.subscription ?? null;
  const status = subscription ? STATUS_VIEW[subscription.status] : null;
  const usage = overview?.usage;
  const warnings = usage
    ? Object.values(usage).filter((item) => item.warning).length
    : 0;
  const totalDays = subscription
    ? Math.max(
        1,
        Math.round(
          (new Date(subscription.expiresAt).getTime() -
            new Date(subscription.startsAt).getTime()) /
            DAY_MS,
        ),
      )
    : 1;
  const periodLeft = subscription
    ? Math.min(100, Math.round((subscription.daysRemaining / totalDays) * 100))
    : 0;

  return (
    <OrganizerPage className="organizer-subscription">
      <PageHeader
        title="Gói dịch vụ"
        subtitle="Xem gói hiện tại, trạng thái, ngày hết hạn và mức dùng của cả bốn giới hạn."
        actions={
          <>
            <Link to="/organizer/subscription/renew">
              <OrganizerButton>Gia hạn</OrganizerButton>
            </Link>
            <Link to="/organizer/subscription/upgrade">
              <OrganizerButton type="primary">Nâng cấp</OrganizerButton>
            </Link>
          </>
        }
      />
      {loading && <Spin />}
      {error && <VietnameseAlert type="error" showIcon message={error} />}
      {overview && !subscription && (
        <VietnameseAlert
          type="warning"
          showIcon
          message="Tổ chức của bạn chưa có gói dịch vụ hiện hành."
        />
      )}

      {subscription && status && (
        <section className={`sub-hero sub-hero-${status.tone}`}>
          <div className="sub-hero-top">
            <div>
              <span className="sub-hero-eyebrow">Gói hiện tại</span>
              <h2 className="sub-hero-plan">{subscription.planName}</h2>
              <p className="sub-hero-price">
                {formatVnd(subscription.price)}
                <span> / {totalDays} ngày</span>
              </p>
            </div>
            <div className="sub-hero-side">
              <span className={`sub-status sub-status-${status.tone}`}>
                <i />
                {subscriptionStatusViewVi(subscription.status).label}
              </span>
              <span className="sub-hero-access">{status.access}</span>
            </div>
          </div>
          <div className="sub-hero-dates">
            <div>
              <span>Bắt đầu</span>
              <strong>{formatDate(subscription.startsAt)}</strong>
            </div>
            <div>
              <span>Hết hạn</span>
              <strong>{formatDate(subscription.expiresAt)}</strong>
            </div>
            <div className="sub-hero-countdown">
              <strong>{subscription.daysRemaining}</strong>
              <span>ngày còn lại</span>
            </div>
          </div>
          <div className="sub-hero-period">
            <div className="sub-hero-period-bar">
              <span style={{ width: `${periodLeft}%` }} />
            </div>
            <small>Còn {periodLeft.toLocaleString("vi-VN")}% thời hạn của kỳ này</small>
          </div>
          {overview?.scheduledRenewal && (
            <div className="sub-hero-next">
              Kỳ tiếp theo (gói {overview.scheduledRenewal.planName}) đã được
              thanh toán: từ {formatDate(overview.scheduledRenewal.startsAt)}{" "}
              đến {formatDate(overview.scheduledRenewal.expiresAt)}
            </div>
          )}
        </section>
      )}

      {subscription?.status === "Grace" && (
        <VietnameseAlert
          type="warning"
          showIcon
          message={`Gói dịch vụ đã hết hạn ngày ${formatDate(subscription.expiresAt)}. Thời gian ân hạn kết thúc ngày ${formatDate(subscription.graceEndsAt)}.`}
          description="Học viên vẫn học tiếp và hoàn thành được các khóa học đã tham gia nhưng không đăng ký khóa học mới. Bạn không thêm được tài khoản, không tạo được khóa học và không tải được học liệu cho tới khi gia hạn."
        />
      )}
      {subscription?.status === "Suspended" && (
        <VietnameseAlert
          type="error"
          showIcon
          message="Gói dịch vụ của bạn đang tạm ngưng."
          description={`Học viên và giảng viên không đăng nhập được. Bạn vẫn xem và kết xuất được báo cáo đào tạo tới ngày ${formatDate(subscription.readOnlyEndsAt)}. Hãy gia hạn để khôi phục toàn bộ quyền truy cập.`}
        />
      )}

      {overview && usage && (
        <SectionCard title="Mức sử dụng gói">
          {warnings > 0 ? (
            <VietnameseAlert
              className="sub-usage-banner"
              type="warning"
              showIcon
              message={`${warnings} giới hạn đã đạt ${overview.usageWarningThresholdPercent}% mức của gói.`}
              description="Hãy cân nhắc nâng cấp trước khi giới hạn chặn việc thêm tài khoản, tạo khóa học hoặc tải học liệu."
            />
          ) : (
            <p className="organizer-note">
              Cảnh báo xuất hiện khi một giới hạn đạt{" "}
              {overview.usageWarningThresholdPercent}% mức của gói.
            </p>
          )}
          <div className="sub-usage-grid">
            <UsageCard
              icon={<TeamOutlined aria-hidden="true" />}
              label="Học viên"
              item={usage.learners}
            />
            <UsageCard
              icon={<SolutionOutlined aria-hidden="true" />}
              label="Giảng viên"
              item={usage.instructors}
            />
            <UsageCard
              icon={<BookOutlined aria-hidden="true" />}
              label="Khóa học"
              item={usage.courses}
            />
            <UsageCard
              icon={<CloudOutlined aria-hidden="true" />}
              label="Dung lượng lưu trữ"
              item={usage.storageBytes}
              format={formatBytes}
            />
          </div>
          <div className="organizer-subscription-usage-note">
            Tài khoản bị vô hiệu hóa vẫn chiếm chỗ; chỉ tài khoản đã xóa mới
            giải phóng chỗ. Khóa học được đếm theo chuỗi phiên bản. Không hỗ trợ
            hạ cấp, và gói nâng cấp phải đủ cho mức đang dùng ở cả bốn giới hạn.
          </div>
        </SectionCard>
      )}

      {overview && (
        <SectionCard title="Quy tắc vòng đời">
          <div className="sub-lifecycle">
            <div>
              <strong>{overview.graceDays} ngày</strong>
              <span>
                Thời gian ân hạn sau khi hết hạn. Học viên học tiếp các khóa học
                đã tham gia nhưng không đăng ký mới.
              </span>
            </div>
            <div>
              <strong>{overview.organizerReadOnlyDays} ngày</strong>
              <span>
                Hết ân hạn, gói dịch vụ chuyển sang tạm ngưng. Quản lý đào tạo
                vẫn xem và kết xuất được báo cáo đào tạo; dữ liệu được giữ lại.
              </span>
            </div>
          </div>
        </SectionCard>
      )}
    </OrganizerPage>
  );
};

export default Subscription;
