import { Alert, Avatar, Button, Empty, Spin } from "antd";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AdminButton,
  AdminPage,
  DetailItem,
  PageHeader,
  SectionCard,
  StatusTag,
  WarningPanel,
} from "@/components/admin/admin.ui";
import { getAdminOrganizationDetailAPI } from "@/services/organization.service";
import type { IAdminOrganizationDetail, IAdminUsageItem } from "@/types/organization.types";
import { formatDateVN } from "@/utils/helper";
import { formatBytes, organizerStatusView, usageLabel, usageWidth } from "@/utils/organization.detail.view";
import { organizationStatusView, subscriptionStatusView } from "@/utils/organization.list.view";
import "./organization.detail.scss";

type LoadError = "notFound" | "failed";

const UsageMetric = ({
  label,
  item,
  format,
}: {
  label: string;
  item: IAdminUsageItem;
  format?: (value: number) => string;
}) => (
  <div className="admin-metric">
    <span>{label}</span>
    <strong>{usageLabel(item, format)}</strong>
    {item.used !== null && (
      <>
        <div className={`admin-usage ${item.warning ? "admin-usage-warning" : ""}`.trim()}>
          <span style={{ width: usageWidth(item) }} />
        </div>
        <small>{item.percent}% used</small>
      </>
    )}
  </div>
);

// UC44.1 - Admin xem chi tiết Organization. Chỉ đọc; tạm khóa (UC44.3) và thay Organizer (UC44.5) làm sau.
const OrganizationDetail = () => {
  const { organizationId = "" } = useParams();
  const [detail, setDetail] = useState<IAdminOrganizationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    // ignore: bỏ kết quả của request cũ khi đổi organizationId trước lúc nó trả về
    let ignore = false;
    const loadDetail = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await getAdminOrganizationDetailAPI(organizationId);
        if (ignore) return;
        if (res.data) {
          setDetail(res.data);
        } else {
          // 400: id sai định dạng; 404: không tồn tại
          const status = Number(res.statusCode);
          setDetail(null);
          setLoadError(status === 400 || status === 404 ? "notFound" : "failed");
        }
      } catch {
        if (!ignore) {
          setDetail(null);
          setLoadError("failed");
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    loadDetail();
    return () => {
      ignore = true;
    };
  }, [organizationId, reloadKey]);

  if (loading && !detail) {
    return (
      <AdminPage className="admin-organization-detail">
        <div className="admin-detail-loading">
          <Spin />
        </div>
      </AdminPage>
    );
  }

  if (loadError || !detail) {
    return (
      <AdminPage className="admin-organization-detail">
        <PageHeader back title="Organization detail" subtitle="Platform organization record" />
        {loadError === "notFound" ? (
          <SectionCard>
            <Empty description="Organization not found.">
              <Link to="/admin/organizations">
                <AdminButton>Back to organizations</AdminButton>
              </Link>
            </Empty>
          </SectionCard>
        ) : (
          <Alert
            type="error"
            showIcon
            message="Could not load this organization."
            description="Please check your connection and try again."
            action={<Button onClick={() => setReloadKey((key) => key + 1)}>Try again</Button>}
          />
        )}
      </AdminPage>
    );
  }

  const orgStatus = organizationStatusView[detail.status];
  const { organizer, subscription, usage, duplicateTaxCode } = detail;

  return (
    <AdminPage className="admin-organization-detail">
      <PageHeader
        back
        title={detail.name}
        subtitle={`Organization detail · registered ${formatDateVN(detail.createdAt)}`}
        actions={
          <>
            <AdminButton disabled title="Available with UC44.5">
              Replace Organizer
            </AdminButton>
            <AdminButton danger disabled title="Available with UC44.3">
              Suspend
            </AdminButton>
          </>
        }
      />

      {duplicateTaxCode.count > 0 && (
        <div className="admin-duplicate-tax">
          <WarningPanel
            title={`Tax code ${detail.taxCode} is also used by ${duplicateTaxCode.count} other organization${duplicateTaxCode.count > 1 ? "s" : ""}`}
          >
            Tax codes are not verified at registration, so please review whether this registration is legitimate. This is
            a warning only; nothing is blocked.
          </WarningPanel>
          <ul>
            {duplicateTaxCode.organizations.map((dup) => {
              const view = organizationStatusView[dup.status];
              return (
                <li key={dup.id}>
                  <Link className="admin-link" to={`/admin/organizations/${encodeURIComponent(dup.id)}`}>
                    {dup.name}
                  </Link>
                  <StatusTag tone={view.tone}>{view.label}</StatusTag>
                </li>
              );
            })}
            {duplicateTaxCode.count > duplicateTaxCode.organizations.length && (
              <li className="admin-note">
                and {duplicateTaxCode.count - duplicateTaxCode.organizations.length} more
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="admin-content-grid">
        <div className="admin-stack">
          <SectionCard
            title="Organization information"
            extra={<StatusTag tone={orgStatus.tone}>{orgStatus.label}</StatusTag>}
          >
            <div className="admin-organization-identity">
              <Avatar
                shape="square"
                size={48}
                src={detail.logoUrl ?? undefined}
                style={{ background: "#e2e8f0", color: "#475569" }}
              >
                {detail.name.slice(0, 2).toUpperCase()}
              </Avatar>
              <strong>{detail.name}</strong>
            </div>
            <div className="admin-detail-grid">
              <DetailItem label="Tax code">{detail.taxCode}</DetailItem>
              <DetailItem label="Telephone">{detail.contactPhone}</DetailItem>
              <DetailItem label="Contact email">{detail.contactEmail ?? "—"}</DetailItem>
              <DetailItem label="Timezone">{detail.timezone}</DetailItem>
              <DetailItem label="Address">{detail.address}</DetailItem>
            </div>
          </SectionCard>

          <SectionCard
            title="Subscription & usage"
            extra={
              subscription ? (
                <StatusTag tone={subscriptionStatusView[subscription.status].tone}>
                  {subscriptionStatusView[subscription.status].label}
                </StatusTag>
              ) : (
                <StatusTag tone="neutral">{detail.status === "PendingPayment" ? "Awaiting payment" : "None"}</StatusTag>
              )
            }
          >
            <div className="admin-metric-row">
              <div className="admin-metric">
                <span>Plan</span>
                <strong>{detail.plan?.name ?? "—"}</strong>
                <small>{subscription ? "Current plan" : "Registered plan"}</small>
              </div>
              <div className="admin-metric">
                <span>Term</span>
                <strong>
                  {subscription
                    ? `${formatDateVN(subscription.startsAt)} – ${formatDateVN(subscription.expiresAt)}`
                    : "—"}
                </strong>
                <small>
                  {subscription
                    ? `${subscription.daysRemaining} days remaining`
                    : detail.paymentDueAt
                      ? `Pay by ${formatDateVN(detail.paymentDueAt)}`
                      : "No current subscription"}
                </small>
              </div>
              {subscription?.graceEndsAt && (
                <div className="admin-metric">
                  <span>Grace until</span>
                  <strong>{formatDateVN(subscription.graceEndsAt)}</strong>
                  <small>Grace period end</small>
                </div>
              )}
              {subscription?.readOnlyEndsAt && (
                <div className="admin-metric">
                  <span>Read-only until</span>
                  <strong>{formatDateVN(subscription.readOnlyEndsAt)}</strong>
                  <small>Organizer read-only access</small>
                </div>
              )}
            </div>

            {usage ? (
              <>
                <div className="admin-metric-row admin-usage-row">
                  <UsageMetric label="Learners" item={usage.learners} />
                  <UsageMetric label="Instructors" item={usage.instructors} />
                  <UsageMetric label="Courses" item={usage.courses} />
                  <UsageMetric label="Storage" item={usage.storageBytes} format={formatBytes} />
                </div>
                {!usage.courseUsageAvailable && (
                  <p className="admin-note">
                    Course and storage usage could not be loaded from the course service right now.
                  </p>
                )}
                <p className="admin-note">
                  Courses are counted per version chain. Warning at {detail.usageWarningThresholdPercent}% of a limit.
                </p>
              </>
            ) : (
              <p className="admin-note">No current subscription, so usage limits do not apply.</p>
            )}
          </SectionCard>
        </div>

        <SectionCard title="Current Organizer">
          {organizer ? (
            <>
              <div className="admin-organizer-card">
                <strong>{organizer.fullName}</strong>
                <span>{organizer.email}</span>
                <StatusTag tone={organizerStatusView(organizer).tone}>{organizerStatusView(organizer).label}</StatusTag>
              </div>
              <div className="admin-organizer-meta">
                {organizer.activatedAt && <span>Activated {formatDateVN(organizer.activatedAt)}</span>}
                {organizer.invitation && (
                  <>
                    <span>Invitation sent {formatDateVN(organizer.invitation.sentAt)}</span>
                    <span>
                      {organizer.invitation.expired ? "Expired" : "Expires"}{" "}
                      {formatDateVN(organizer.invitation.expiresAt)}
                    </span>
                  </>
                )}
              </div>
            </>
          ) : (
            <p className="admin-note">No current Organizer.</p>
          )}
          <p className="admin-note">One Organizer per Organization, including one awaiting an invitation.</p>
        </SectionCard>
      </div>

      <SectionCard title="Sanction history" className="admin-sanction-card">
        {detail.suspensions.length === 0 ? (
          <p className="admin-note admin-sanction-empty">No suspension recorded.</p>
        ) : (
          <>
            <div className="admin-sanction-row admin-sanction-head">
              <span>Suspended</span>
              <span>Lifted</span>
              <span>Reason</span>
              <span>Status</span>
            </div>
            {detail.suspensions.map((suspension) => (
              <div className="admin-sanction-row" key={suspension.id}>
                <strong>{formatDateVN(suspension.startedAt)}</strong>
                <span>{suspension.endedAt ? formatDateVN(suspension.endedAt) : "—"}</span>
                <span>{suspension.reason}</span>
                {suspension.endedAt ? (
                  <StatusTag tone="neutral">Lifted</StatusTag>
                ) : (
                  <StatusTag tone="error">In effect</StatusTag>
                )}
              </div>
            ))}
          </>
        )}
      </SectionCard>
    </AdminPage>
  );
};

export default OrganizationDetail;
