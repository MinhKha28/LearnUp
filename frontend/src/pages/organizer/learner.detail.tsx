import { Alert, Avatar, Button, Empty, Skeleton, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { statusLabel } from "@/components/organizer/account.table";
import { LearnerDeleteButton } from "@/components/organizer/learner.delete.button";
import { LearnerStatusButton } from "@/components/organizer/learner.status.button";
import { ResendInvitationButton } from "@/components/organizer/resend.invitation.button";
import {
  DetailItem,
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
  StatusTag,
} from "@/components/organizer/organizer.ui";
import { initialsOf } from "@/hooks/use.my.profile";
import { getLearnerDetailAPI } from "@/services/organization.service";
import type {
  AccountStatus,
  ILearnerDetail,
  ILearnerEnrollment,
} from "@/types/organization.types";
import { assignmentStatus } from "@/utils/assignments.view";
import { formatDateVN } from "@/utils/helper";
import { UNKNOWN_LABEL, enrollmentKindText } from "@/utils/organizer.labels";
import "./learner.detail.scss";

type Tone = "neutral" | "success" | "warning" | "error" | "info";

// Cùng màu với cột Status của danh sách UC13 (account.table)
const accountTone = (status: AccountStatus): Tone =>
  status === "Active"
    ? "success"
    : status === "Pending"
      ? "warning"
      : "neutral";

// Nhãn trạng thái Enrollment (BR-115) dùng chung bảng assignmentStatus của UC24
const courseColumns: ColumnsType<ILearnerEnrollment> = [
  {
    title: "Khóa học",
    key: "course",
    render: (_, row) =>
      row.course ? (
        <strong>
          {row.course.name} · v{row.course.versionNumber}
        </strong>
      ) : (
        <span className="organizer-note">Khóa học không khả dụng</span>
      ),
  },
  {
    title: "Loại",
    dataIndex: "enrollmentType",
    render: (type: ILearnerEnrollment["enrollmentType"]) => (
      <StatusTag tone={type === "Required" ? "info" : "neutral"}>{enrollmentKindText(type)}</StatusTag>
    ),
  },
  {
    title: "Trạng thái",
    dataIndex: "status",
    render: (status: ILearnerEnrollment["status"]) => {
      const view = assignmentStatus[status];
      return view ? (
        <StatusTag tone={view.tone}>{view.label}</StatusTag>
      ) : (
        <StatusTag tone="neutral">{UNKNOWN_LABEL}</StatusTag>
      );
    },
  },
  {
    // Chỉ đếm học liệu bắt buộc, không gồm Quiz / Assignment
    title: "Học liệu bắt buộc",
    key: "requiredMaterials",
    render: (_, row) =>
      row.requiredMaterials.total > 0
        ? `${row.requiredMaterials.completed}/${row.requiredMaterials.total}`
        : "—",
  },
  {
    // Optional không có hạn (BR-129)
    title: "Hạn hoàn thành",
    dataIndex: "dueAt",
    render: (dueAt: string | null) => (dueAt ? formatDateVN(dueAt) : "—"),
  },
];

type LoadError = "notFound" | "failed";

const LearnerDetail = () => {
  const { learnerId = "" } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ILearnerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    // ignore: bỏ kết quả của request cũ khi đổi learnerId trước lúc nó trả về
    let ignore = false;
    const loadDetail = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await getLearnerDetailAPI(learnerId);
        if (ignore) return;
        if (res.data) {
          setDetail(res.data);
        } else {
          // 400: id sai định dạng; 404: không tồn tại / khác tổ chức / đã xóa / không phải Learner
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
  }, [learnerId, reloadKey]);

  const backToList = useCallback(
    () => navigate("/organizer/learners", { replace: true }),
    [navigate],
  );

  // UC13.3: sửa được ở mọi trạng thái (đơn vị công tác, BR-42)
  const headerActions: ReactNode = detail ? (
    <>
      {/* UC13.6 - xóa được ở mọi trạng thái; xóa xong về danh sách UC13 */}
      <LearnerDeleteButton
        learnerId={detail.id}
        fullName={detail.fullName}
        status={detail.status}
        onDeleted={backToList}
      />
      {/* UC13.5 - tự ẩn khi Pending / chưa từng kích hoạt */}
      <LearnerStatusButton
        learnerId={detail.id}
        fullName={detail.fullName}
        status={detail.status}
        activatedAt={detail.activatedAt}
        onChanged={() => setReloadKey((key) => key + 1)}
      />
      {detail.status === "Pending" && (
        <ResendInvitationButton
          role="Learner"
          accountId={detail.id}
          email={detail.email}
          onChanged={() => setReloadKey((key) => key + 1)}
        />
      )}
      <Link to={`/organizer/learners/${detail.id}/edit`}>
        <OrganizerButton type="primary">Chỉnh sửa</OrganizerButton>
      </Link>
    </>
  ) : null;

  const renderBody = () => {
    if (loading) {
      return (
        <SectionCard>
          <Skeleton active />
        </SectionCard>
      );
    }
    if (loadError === "notFound") {
      return (
        <Alert
          type="warning"
          showIcon
          message="Không tìm thấy Học viên"
          description="Học viên này không tồn tại hoặc không còn thuộc tổ chức của bạn."
          action={
            <Link to="/organizer/learners">
              <Button>Quay lại</Button>
            </Link>
          }
        />
      );
    }
    if (loadError || !detail) {
      return (
        <Alert
          type="error"
          showIcon
          message="Không thể tải thông tin Học viên."
          description="Vui lòng kiểm tra kết nối và thử lại."
          action={
            <Button onClick={() => setReloadKey((key) => key + 1)}>
              Thử lại
            </Button>
          }
        />
      );
    }

    const isPending = detail.status === "Pending";
    // BR-34, BR-33: trước khi kích hoạt Organizer sửa họ tên, email; sau đó Learner tự quản lý
    // họ tên, ảnh đại diện, email đăng nhập không sửa được. Đơn vị công tác luôn do Organizer quản lý.
    const activated = detail.activatedAt !== null;
    return (
      <>
        <div className="organizer-content-grid">
          <SectionCard>
            <div className="organizer-learner-identity">
              <Avatar size={56} src={detail.avatarUrl ?? undefined}>
                {initialsOf(detail.fullName)}
              </Avatar>
              <h2>{detail.fullName}</h2>
              <StatusTag tone={accountTone(detail.status)}>
                {statusLabel[detail.status]}
              </StatusTag>
              {isPending && detail.invitationExpired && (
                <StatusTag tone="error">Lời mời đã hết hạn</StatusTag>
              )}
            </div>
            <div className="organizer-detail-grid">
              <DetailItem label="Email">{detail.email}</DetailItem>
              <DetailItem label="Đơn vị công tác">
                {detail.department || "—"}
              </DetailItem>
              <DetailItem label="Ngày tạo">
                {formatDateVN(detail.createdAt)}
              </DetailItem>
              <DetailItem label="Đã kích hoạt">
                {detail.activatedAt ? formatDateVN(detail.activatedAt) : "—"}
              </DetailItem>
              {isPending && (
                <>
                  <DetailItem label="Đã gửi lời mời">
                    {detail.invitation
                      ? formatDateVN(detail.invitation.sentAt)
                      : "—"}
                  </DetailItem>
                  <DetailItem label="Lời mời hết hạn vào">
                    {detail.invitation
                      ? formatDateVN(detail.invitation.expiresAt)
                      : "Không có lời mời còn hiệu lực"}
                  </DetailItem>
                </>
              )}
            </div>
          </SectionCard>
          <SectionCard title="Người có thể chỉnh sửa">
            <div className="organizer-detail-grid">
              <DetailItem label="Họ và tên">
                {activated ? "Học viên" : "Quản lý đào tạo (trước khi kích hoạt)"}
              </DetailItem>
              <DetailItem label="Email">
                {activated ? "Không thể chỉnh sửa" : "Quản lý đào tạo (trước khi kích hoạt)"}
              </DetailItem>
              <DetailItem label="Ảnh đại diện">
                {activated ? "Học viên" : "Học viên (sau khi kích hoạt)"}
              </DetailItem>
              <DetailItem label="Đơn vị công tác">Quản lý đào tạo</DetailItem>
            </div>
          </SectionCard>
        </div>

        <SectionCard
          title="Các Khóa học đã tham gia"
          className="organizer-learner-courses"
        >
          {detail.status === "Deactivated" && (
            <p className="organizer-note">
              Tài khoản này đã bị vô hiệu hóa. Các lượt ghi danh vẫn được giữ lại
              nhưng không được tính vào thống kê quá hạn.
            </p>
          )}
          {detail.enrollments === null ? (
            <Alert
              type="warning"
              showIcon
              message="Không thể tải Khóa học"
              description="Tạm thời không xem được thông tin tham gia Khóa học. Vui lòng thử lại sau."
            />
          ) : (
            <Table<ILearnerEnrollment>
              className="organizer-table"
              rowKey="enrollmentId"
              columns={courseColumns}
              dataSource={detail.enrollments}
              pagination={false}
              scroll={{ x: "max-content" }}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="Chưa tham gia Khóa học nào"
                  />
                ),
              }}
            />
          )}
        </SectionCard>
      </>
    );
  };

  return (
    <OrganizerPage className="organizer-learner-detail">
      <PageHeader
        title="Chi tiết Học viên"
        subtitle="Trạng thái tài khoản và các Khóa học đã tham gia."
        back
        actions={headerActions}
      />
      {renderBody()}
    </OrganizerPage>
  );
};

export default LearnerDetail;
