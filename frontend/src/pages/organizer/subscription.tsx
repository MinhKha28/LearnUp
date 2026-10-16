import { useEffect, useState, type ReactNode } from "react";
import { Alert, Spin } from "antd";
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
import { formatVnd } from "@/utils/helper";
import "./subscription.scss";

const DAY_MS = 24 * 60 * 60 * 1000;

const formatDate = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "-";

const formatBytes = (bytes: number) => {
  if (bytes >= 1024 ** 3) return `${+(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${+(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${+(bytes / 1024).toFixed(1)} KB`;
};

const STATUS_VIEW: Record<
  SubscriptionStatus,
  { label: string; tone: string; access: string }
> = {
  Active: { label: "Active", tone: "active", access: "Full access" },
  Grace: { label: "Grace period", tone: "grace", access: "Limited access" },
  Suspended: { label: "Suspended", tone: "suspended", access: "Read-only" },
};

const usageLevel = (item: IUsageItem) =>
  (item.percent ?? 0) >= 100 ? "full" : item.warning ? "warning" : "ok";

const UsageCard = ({
  icon,
  label,
  item,
  format = (value: number) => String(value),
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
        {level !== "ok" && <WarningFilled className="sub-usage-alert" />}
      </div>
      {item.used === null ? (
        <>
          <strong className="sub-usage-value">-</strong>
          <small className="sub-usage-caption">Unavailable right now</small>
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
            {item.percent}% used
            {level === "full"
              ? " - limit reached"
              : level === "warning"
                ? " - close to the limit"
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
        else setError("Could not load the subscription.");
      } catch {
        if (active) setError("Could not connect to the server.");
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
        title="Subscription"
        subtitle="Review current plan, status, expiry, and all four usage limits."
        actions={
          <>
            <Link to="/organizer/subscription/renew">
              <OrganizerButton>Renew</OrganizerButton>
            </Link>
            <Link to="/organizer/subscription/upgrade">
              <OrganizerButton type="primary">Upgrade</OrganizerButton>
            </Link>
          </>
        }
      />
      {loading && <Spin />}
      {error && <Alert type="error" showIcon message={error} />}
      {overview && !subscription && (
        <Alert
          type="warning"
          showIcon
          message="Your organization has no current subscription."
        />
      )}

      {subscription && status && (
        <section className={`sub-hero sub-hero-${status.tone}`}>
          <div className="sub-hero-top">
            <div>
              <span className="sub-hero-eyebrow">CURRENT PLAN</span>
              <h2 className="sub-hero-plan">{subscription.planName}</h2>
              <p className="sub-hero-price">
                {formatVnd(subscription.price)}
                <span> / {totalDays} days</span>
              </p>
            </div>
            <div className="sub-hero-side">
              <span className={`sub-status sub-status-${status.tone}`}>
                <i />
                {status.label}
              </span>
              <span className="sub-hero-access">{status.access}</span>
            </div>
          </div>
          <div className="sub-hero-dates">
            <div>
              <span>Started</span>
              <strong>{formatDate(subscription.startsAt)}</strong>
            </div>
            <div>
              <span>Expires</span>
              <strong>{formatDate(subscription.expiresAt)}</strong>
            </div>
            <div className="sub-hero-countdown">
              <strong>{subscription.daysRemaining}</strong>
              <span>days remaining</span>
            </div>
          </div>
          <div className="sub-hero-period">
            <div className="sub-hero-period-bar">
              <span style={{ width: `${periodLeft}%` }} />
            </div>
            <small>{periodLeft}% of this period left</small>
          </div>
          {overview?.scheduledRenewal && (
            <div className="sub-hero-next">
              Next period ({overview.scheduledRenewal.planName}) is already
              paid: {formatDate(overview.scheduledRenewal.startsAt)} -{" "}
              {formatDate(overview.scheduledRenewal.expiresAt)}
            </div>
          )}
        </section>
      )}

      {subscription?.status === "Grace" && (
        <Alert
          type="warning"
          showIcon
          message={`Your plan expired on ${formatDate(subscription.expiresAt)}. The grace period ends on ${formatDate(subscription.graceEndsAt)}.`}
          description="Learners can finish courses they already joined but cannot enroll in new ones. You cannot add accounts, create courses or upload materials until you renew."
        />
      )}
      {subscription?.status === "Suspended" && (
        <Alert
          type="error"
          showIcon
          message="Your subscription is suspended."
          description={`Learners and Instructors cannot sign in. You can view and export training reports until ${formatDate(subscription.readOnlyEndsAt)}. Renew to restore full access.`}
        />
      )}

      {overview && usage && (
        <SectionCard title="Plan usage">
          {warnings > 0 ? (
            <Alert
              className="sub-usage-banner"
              type="warning"
              showIcon
              message={`${warnings} ${warnings === 1 ? "limit has" : "limits have"} reached ${overview.usageWarningThresholdPercent}% of your plan.`}
              description="Consider upgrading before the limit blocks new accounts, courses or uploads."
            />
          ) : (
            <p className="organizer-note">
              Warnings appear when a limit reaches{" "}
              {overview.usageWarningThresholdPercent}% of your plan.
            </p>
          )}
          <div className="sub-usage-grid">
            <UsageCard
              icon={<TeamOutlined />}
              label="Learners"
              item={usage.learners}
            />
            <UsageCard
              icon={<SolutionOutlined />}
              label="Instructors"
              item={usage.instructors}
            />
            <UsageCard
              icon={<BookOutlined />}
              label="Courses"
              item={usage.courses}
            />
            <UsageCard
              icon={<CloudOutlined />}
              label="Storage"
              item={usage.storageBytes}
              format={formatBytes}
            />
          </div>
          <div className="organizer-subscription-usage-note">
            Deactivated accounts still use a seat; only deleted accounts free
            it. Courses are counted per version chain. Downgrade is not
            supported, and an upgrade must cover current usage across all four
            limits.
          </div>
        </SectionCard>
      )}

      {overview && (
        <SectionCard title="Lifecycle rules">
          <div className="sub-lifecycle">
            <div>
              <strong>{overview.graceDays} days</strong>
              <span>
                Grace period after expiry. Learners continue existing
                Enrollments, no new Enrollments.
              </span>
            </div>
            <div>
              <strong>{overview.organizerReadOnlyDays} days</strong>
              <span>
                After grace the subscription is Suspended. Organizer can view
                and export training reports; data is retained.
              </span>
            </div>
          </div>
        </SectionCard>
      )}
    </OrganizerPage>
  );
};

export default Subscription;
