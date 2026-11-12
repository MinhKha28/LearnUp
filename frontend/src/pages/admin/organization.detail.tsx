import { VietnameseAlert } from "@/components/vietnamese.controls";
import { Avatar, Button, Empty, Spin } from "antd";
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
import {
  formatBytes,
  organizationStatusViewVi,
  organizerStatusView,
  subscriptionStatusViewVi,
  usageLabel,
  usageWidth,
} from "@/utils/organization.detail.view";
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
        <small>Đã dùng {item.percent?.toLocaleString("vi-VN") ?? "—"}%</small>
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
        <PageHeader back title="Chi tiết tổ chức" subtitle="Hồ sơ tổ chức trên nền tảng" />
        {loadError === "notFound" ? (
          <SectionCard>
            <Empty description="Không tìm thấy tổ chức.">
              <Link to="/admin/organizations">
                <AdminButton>Về danh sách tổ chức</AdminButton>
              </Link>
            </Empty>
          </SectionCard>
        ) : (
          <VietnameseAlert
            type="error"
            showIcon
            message="Chưa tải được tổ chức này."
            description="Vui lòng kiểm tra kết nối rồi thử lại."
            action={<Button onClick={() => setReloadKey((key) => key + 1)}>Thử lại</Button>}
          />
        )}
      </AdminPage>
    );
  }

  const orgStatus = organizationStatusViewVi(detail.status);
  const { organizer, subscription, usage, duplicateTaxCode } = detail;

  return (
    <AdminPage className="admin-organization-detail">
      {/* Đang tải tổ chức khác (bấm liên kết trùng mã số thuế): giữ bản cũ trên màn hình nhưng có dấu đang tải. */}
      <Spin spinning={loading} tip="Đang tải...">
        <PageHeader
          back
          title={detail.name}
          subtitle={`Chi tiết tổ chức · đăng ký ngày ${formatDateVN(detail.createdAt)}`}
          actions={
            <>
              <AdminButton disabled title="Có ở UC44.5">
                Thay quản lý đào tạo
              </AdminButton>
              <AdminButton danger disabled title="Có ở UC44.3">
                Tạm khóa
              </AdminButton>
            </>
          }
        />

        {duplicateTaxCode.count > 0 && (
          <div className="admin-duplicate-tax">
            <WarningPanel
              title={`Mã số thuế ${detail.taxCode} cũng được ${duplicateTaxCode.count} tổ chức khác sử dụng`}
            >
              Mã số thuế không được xác minh khi đăng ký, vui lòng kiểm tra lại đăng ký này có hợp lệ không. Đây chỉ là
              cảnh báo, không có gì bị chặn.
            </WarningPanel>
            <ul>
              {duplicateTaxCode.organizations.map((dup) => {
                const view = organizationStatusViewVi(dup.status);
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
                  và {duplicateTaxCode.count - duplicateTaxCode.organizations.length} tổ chức khác
                </li>
              )}
            </ul>
          </div>
        )}

        <div className="admin-content-grid">
          <div className="admin-stack">
            <SectionCard
              title="Thông tin tổ chức"
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
                <DetailItem label="Mã số thuế">{detail.taxCode}</DetailItem>
                <DetailItem label="Số điện thoại">{detail.contactPhone}</DetailItem>
                <DetailItem label="Email liên hệ">{detail.contactEmail ?? "—"}</DetailItem>
                <DetailItem label="Múi giờ">{detail.timezone}</DetailItem>
                <DetailItem label="Địa chỉ">{detail.address}</DetailItem>
              </div>
            </SectionCard>

            <SectionCard
              title="Gói dịch vụ và mức dùng"
              extra={
                subscription ? (
                  <StatusTag tone={subscriptionStatusViewVi(subscription.status).tone}>
                    {subscriptionStatusViewVi(subscription.status).label}
                  </StatusTag>
                ) : (
                  <StatusTag tone="neutral">
                    {detail.status === "PendingPayment" ? "Chờ thanh toán" : "Không có"}
                  </StatusTag>
                )
              }
            >
              <div className="admin-metric-row">
                <div className="admin-metric">
                  <span>Gói</span>
                  <strong>{detail.plan?.name ?? "—"}</strong>
                  <small>{subscription ? "Gói hiện tại" : "Gói đã đăng ký"}</small>
                </div>
                <div className="admin-metric">
                  <span>Thời hạn</span>
                  <strong>
                    {subscription
                      ? `${formatDateVN(subscription.startsAt)} – ${formatDateVN(subscription.expiresAt)}`
                      : "—"}
                  </strong>
                  <small>
                    {subscription
                      ? `Còn ${subscription.daysRemaining} ngày`
                      : detail.paymentDueAt
                        ? `Thanh toán trước ngày ${formatDateVN(detail.paymentDueAt)}`
                        : "Chưa có gói dịch vụ hiện hành"}
                  </small>
                </div>
                {subscription?.graceEndsAt && (
                  <div className="admin-metric">
                    <span>Ân hạn đến</span>
                    <strong>{formatDateVN(subscription.graceEndsAt)}</strong>
                    <small>Ngày hết thời gian ân hạn</small>
                  </div>
                )}
                {subscription?.readOnlyEndsAt && (
                  <div className="admin-metric">
                    <span>Chỉ đọc đến</span>
                    <strong>{formatDateVN(subscription.readOnlyEndsAt)}</strong>
                    <small>Quản lý đào tạo chỉ được xem</small>
                  </div>
                )}
              </div>

              {usage ? (
                <>
                  <div className="admin-metric-row admin-usage-row">
                    <UsageMetric label="Học viên" item={usage.learners} />
                    <UsageMetric label="Giảng viên" item={usage.instructors} />
                    <UsageMetric label="Khóa học" item={usage.courses} />
                    <UsageMetric label="Dung lượng lưu trữ" item={usage.storageBytes} format={formatBytes} />
                  </div>
                  {!usage.courseUsageAvailable && (
                    <p className="admin-note">
                      Hiện chưa lấy được số khóa học và dung lượng lưu trữ từ dịch vụ khóa học.
                    </p>
                  )}
                  <p className="admin-note">
                    Khóa học được đếm theo chuỗi phiên bản. Cảnh báo khi dùng đến {detail.usageWarningThresholdPercent}%
                    giới hạn.
                  </p>
                </>
              ) : (
                <p className="admin-note">Chưa có gói dịch vụ hiện hành nên chưa áp dụng giới hạn sử dụng.</p>
              )}
            </SectionCard>
          </div>

          <SectionCard title="Quản lý đào tạo hiện tại">
            {organizer ? (
              <>
                <div className="admin-organizer-card">
                  <strong>{organizer.fullName}</strong>
                  <span>{organizer.email}</span>
                  <StatusTag tone={organizerStatusView(organizer).tone}>{organizerStatusView(organizer).label}</StatusTag>
                </div>
                <div className="admin-organizer-meta">
                  {organizer.activatedAt && <span>Kích hoạt ngày {formatDateVN(organizer.activatedAt)}</span>}
                  {organizer.invitation && (
                    <>
                      <span>Gửi lời mời ngày {formatDateVN(organizer.invitation.sentAt)}</span>
                      <span>
                        {organizer.invitation.expired ? "Đã hết hạn ngày" : "Hết hạn ngày"}{" "}
                        {formatDateVN(organizer.invitation.expiresAt)}
                      </span>
                    </>
                  )}
                </div>
              </>
            ) : (
              <p className="admin-note">Chưa có quản lý đào tạo hiện tại.</p>
            )}
            <p className="admin-note">
              Mỗi tổ chức có một quản lý đào tạo, kể cả người đang chờ nhận lời mời.
            </p>
          </SectionCard>
        </div>

        <SectionCard title="Lịch sử tạm khóa" className="admin-sanction-card">
          {detail.suspensions.length === 0 ? (
            <p className="admin-note admin-sanction-empty">Chưa có lượt tạm khóa nào.</p>
          ) : (
            <>
              <div className="admin-sanction-row admin-sanction-head">
                <span>Tạm khóa ngày</span>
                <span>Gỡ ngày</span>
                <span>Lý do</span>
                <span>Trạng thái</span>
              </div>
              {detail.suspensions.map((suspension) => (
                <div className="admin-sanction-row" key={suspension.id}>
                  <strong>{formatDateVN(suspension.startedAt)}</strong>
                  <span>{suspension.endedAt ? formatDateVN(suspension.endedAt) : "—"}</span>
                  <span>{suspension.reason}</span>
                  {suspension.endedAt ? (
                    <StatusTag tone="neutral">Đã gỡ</StatusTag>
                  ) : (
                    <StatusTag tone="error">Đang hiệu lực</StatusTag>
                  )}
                </div>
              ))}
            </>
          )}
        </SectionCard>
      </Spin>
    </AdminPage>
  );
};

export default OrganizationDetail;
