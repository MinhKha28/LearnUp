import { Alert, Avatar, Button, Empty, Skeleton, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { statusLabel } from "@/components/organizer/account.table";
import {
  DetailItem,
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
    title: "Course",
    dataIndex: "name",
    render: (name: string) => <strong>{name}</strong>,
  },
  {
    title: "Version",
    dataIndex: "versionNumber",
    render: (versionNumber: number) => `v${versionNumber}`,
  },
  {
    title: "Status",
    dataIndex: "status",
    render: (status: CourseStatus) => (
      <StatusTag tone={courseTone[status] ?? "neutral"}>{status}</StatusTag>
    ),
  },
  { title: "Type", dataIndex: "courseType" },
  {
    title: "Approved",
    dataIndex: "approvedAt",
    render: (approvedAt: string | null) =>
      approvedAt ? formatDateVN(approvedAt) : "—",
  },
];

// UC12.3 / 12.5 / 12.6 / 12.7 gắn nút vào đây; UC12.1 chưa render nút nào
const headerActions: ReactNode = null;

type LoadError = "notFound" | "failed";

const InstructorDetail = () => {
  const { instructorId = "" } = useParams();
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
          message="Instructor not found"
          description="This instructor does not exist or is no longer available in your organization."
          action={
            <Link to="/organizer/instructors">
              <Button>Back</Button>
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
          message="Could not load instructor."
          description="Please check your connection and try again."
          action={
            <Button onClick={() => setReloadKey((key) => key + 1)}>
              Try again
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
              <StatusTag tone="error">Invitation expired</StatusTag>
            )}
          </div>
          <div className="organizer-detail-grid">
            <DetailItem label="Email">{detail.email}</DetailItem>
            <DetailItem label="Work unit">{detail.department || "—"}</DetailItem>
            <DetailItem label="Created">
              {formatDateVN(detail.createdAt)}
            </DetailItem>
            <DetailItem label="Activated">
              {detail.activatedAt ? formatDateVN(detail.activatedAt) : "—"}
            </DetailItem>
            {isPending && (
              <>
                <DetailItem label="Invitation sent">
                  {detail.invitation
                    ? formatDateVN(detail.invitation.sentAt)
                    : "—"}
                </DetailItem>
                <DetailItem label="Invitation expires">
                  {detail.invitation
                    ? formatDateVN(detail.invitation.expiresAt)
                    : "No active invitation"}
                </DetailItem>
              </>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Courses managed"
          className="organizer-instructor-courses"
        >
          {detail.courses === null ? (
            <Alert
              type="warning"
              showIcon
              message="Couldn't load managed courses"
              description="Course information is temporarily unavailable. Please try again later."
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
                    description="No courses managed"
                  />
                ),
              }}
            />
          )}
        </SectionCard>

        {/* BR-251, BR-252: GĐ2 điền detail.violations từ course-service */}
        <SectionCard title="Confirmed violations">
          <p className="organizer-note">
            No data yet — content moderation will be available in phase 2.
          </p>
        </SectionCard>
      </>
    );
  };

  return (
    <OrganizerPage className="organizer-instructor-detail">
      <PageHeader
        title="Instructor detail"
        subtitle="Account, assigned Courses, and confirmed violation history."
        back
        actions={headerActions}
      />
      {renderBody()}
    </OrganizerPage>
  );
};

export default InstructorDetail;
