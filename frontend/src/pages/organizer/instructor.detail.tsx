import { Alert, Avatar, Button, Empty, Skeleton, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { statusLabel } from "@/components/organizer/account.table";
import { InstructorDeleteButton } from "@/components/organizer/instructor.delete.button";
import { InstructorStatusButton } from "@/components/organizer/instructor.status.button";
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
import { getInstructorDetailAPI } from "@/services/organization.service";
import type {
  AccountStatus,
  CourseStatus,
  IInstructorDetail,
  IManagedCourseChain,
} from "@/types/organization.types";
import { formatDateVN } from "@/utils/helper";
import { courseStatusText, courseTypeText } from "@/utils/organizer.labels";
import "./instructor.detail.scss";

type Tone = "neutral" | "success" | "warning" | "error" | "info";

// Cùng màu với cột Status của danh sách UC12 (account.table)
const accountTone = (status: AccountStatus): Tone =>
  status === "Active"
    ? "success"
    : status === "Pending"
      ? "warning"
      : "neutral";

// UC12.1 - màu trạng thái phiên bản Course
const courseTone: Record<CourseStatus, Tone> = {
  Draft: "neutral",
  Submitted: "warning",
  Published: "success",
  Rejected: "error",
  Archived: "neutral",
  Disabled: "error",
};

const courseColumns: ColumnsType<IManagedCourseChain> = [
  {
    title: "Khóa học",
    dataIndex: "name",
    render: (name: string) => <strong>{name}</strong>,
  },
  {
    title: "Phiên bản",
    dataIndex: "versionNumber",
    render: (versionNumber: number) => `v${versionNumber}`,
  },
  {
    title: "Trạng thái",
    dataIndex: "status",
    render: (status: CourseStatus) => (
      <StatusTag tone={courseTone[status] ?? "neutral"}>{courseStatusText(status)}</StatusTag>
    ),
  },
  {
    title: "Loại",
    dataIndex: "courseType",
    render: (type: string) => courseTypeText(type),
  },
  {
    title: "Đã phê duyệt",
    dataIndex: "approvedAt",
    render: (approvedAt: string | null) =>
      approvedAt ? formatDateVN(approvedAt) : "—",
  },
];

type LoadError = "notFound" | "failed";

const InstructorDetail = () => {
  const { instructorId = "" } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<IInstructorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    // ignore: bỏ kết quả của request cũ khi đổi instructorId trước lúc nó trả về
    let ignore = false;
    const loadDetail = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await getInstructorDetailAPI(instructorId);
        if (ignore) return;
        if (res.data) {
          setDetail(res.data);
        } else {
          // 400: id sai định dạng; 404: không tồn tại / khác tổ chức / đã xóa / không phải Instructor
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
  }, [instructorId, reloadKey]);

  // UC12.6: xóa xong (hoặc tài khoản không còn) thì về danh sách UC12; toast do nút Delete hiện.
  const backToList = useCallback(
    () => navigate("/organizer/instructors", { replace: true }),
    [navigate],
  );

  // UC12.3: sửa được ở mọi trạng thái (đơn vị công tác, BR-42).
  // UC12.5: chỉ tài khoản đã kích hoạt mới có Deactivate / Reactivate (component tự ẩn khi không áp dụng).
  // UC12.6: Delete ở mọi trạng thái (BR-46).
  const headerActions: ReactNode = detail ? (
    <>
      <InstructorDeleteButton
        instructorId={detail.id}
        fullName={detail.fullName}
        status={detail.status}
        onDeleted={backToList}
      />
      <InstructorStatusButton
        instructorId={detail.id}
        fullName={detail.fullName}
        status={detail.status}
        activatedAt={detail.activatedAt}
        onChanged={() => setReloadKey((key) => key + 1)}
      />
      {detail.status === "Pending" && (
        <ResendInvitationButton
          role="Instructor"
          accountId={detail.id}
          email={detail.email}
          onChanged={() => setReloadKey((key) => key + 1)}
        />
      )}
      <Link to={`/organizer/instructors/${detail.id}/edit`}>
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
          message="Không tìm thấy giảng viên"
          description="Giảng viên này không tồn tại hoặc không còn thuộc tổ chức của bạn."
          action={
            <Link to="/organizer/instructors">
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
          message="Không thể tải thông tin giảng viên."
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
    return (
      <>
        <SectionCard>
          <div className="organizer-instructor-identity">
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
            <DetailItem label="Đơn vị công tác">{detail.department || "—"}</DetailItem>
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

        <SectionCard
          title="Khóa học phụ trách"
          className="organizer-instructor-courses"
        >
          {detail.courses === null ? (
            <Alert
              type="warning"
              showIcon
              message="Không thể tải khóa học phụ trách"
              description="Tạm thời không xem được thông tin khóa học. Vui lòng thử lại sau."
            />
          ) : (
            <Table<IManagedCourseChain>
              className="organizer-table"
              rowKey="chainId"
              columns={courseColumns}
              dataSource={detail.courses}
              pagination={false}
              scroll={{ x: "max-content" }}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="Chưa phụ trách khóa học nào"
                  />
                ),
              }}
            />
          )}
        </SectionCard>

        {/* BR-251, BR-252: GĐ2 điền detail.violations từ course-service */}
        <SectionCard title="Vi phạm đã xác nhận">
          <p className="organizer-note">
            Chưa có dữ liệu. Tính năng kiểm duyệt nội dung sẽ có trong giai đoạn 2.
          </p>
        </SectionCard>
      </>
    );
  };

  return (
    <OrganizerPage className="organizer-instructor-detail">
      <PageHeader
        title="Chi tiết giảng viên"
        subtitle="Tài khoản, khóa học phụ trách và lịch sử vi phạm đã xác nhận."
        back
        actions={headerActions}
      />
      {renderBody()}
    </OrganizerPage>
  );
};

export default InstructorDetail;
