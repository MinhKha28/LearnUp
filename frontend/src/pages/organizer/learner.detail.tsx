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
import { getLearnerDetailAPI } from "@/services/organization.service";
import type {
  AccountStatus,
  ILearnerDetail,
  ILearnerEnrollment,
} from "@/types/organization.types";
import { assignmentStatus } from "@/utils/assignments.view";
import { formatDateVN } from "@/utils/helper";
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
    title: "Course",
    key: "course",
    render: (_, row) =>
      row.course ? (
        <strong>
          {row.course.name} · v{row.course.versionNumber}
        </strong>
      ) : (
        <span className="organizer-note">Course unavailable</span>
      ),
  },
  {
    title: "Type",
    dataIndex: "enrollmentType",
    render: (type: ILearnerEnrollment["enrollmentType"]) => (
      <StatusTag tone={type === "Required" ? "info" : "neutral"}>{type}</StatusTag>
    ),
  },
  {
    title: "Status",
    dataIndex: "status",
    render: (status: ILearnerEnrollment["status"]) => {
      const view = assignmentStatus[status];
      return view ? (
        <StatusTag tone={view.tone}>{view.label}</StatusTag>
      ) : (
        <StatusTag tone="neutral">{status}</StatusTag>
      );
    },
  },
  {
    // Chỉ đếm học liệu bắt buộc, không gồm Quiz / Assignment
    title: "Required materials",
    key: "requiredMaterials",
    render: (_, row) =>
      row.requiredMaterials.total > 0
        ? `${row.requiredMaterials.completed}/${row.requiredMaterials.total}`
        : "—",
  },
  {
    // Optional không có hạn (BR-129)
    title: "Due",
    dataIndex: "dueAt",
    render: (dueAt: string | null) => (dueAt ? formatDateVN(dueAt) : "—"),
  },
];

// UC13.3 / 13.5 / 13.6 / 13.7 gắn nút vào đây; UC13.1 chưa render nút nào
const headerActions: ReactNode = null;

type LoadError = "notFound" | "failed";

const LearnerDetail = () => {
  const { learnerId = "" } = useParams();
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
          message="Learner not found"
          description="This learner does not exist or is no longer available in your organization."
          action={
            <Link to="/organizer/learners">
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
          message="Could not load learner."
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
                <StatusTag tone="error">Invitation expired</StatusTag>
              )}
            </div>
            <div className="organizer-detail-grid">
              <DetailItem label="Email">{detail.email}</DetailItem>
              <DetailItem label="Work unit">
                {detail.department || "—"}
              </DetailItem>
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
          <SectionCard title="Who can edit">
            <div className="organizer-detail-grid">
              <DetailItem label="Full name">
                {activated ? "Learner" : "Organizer (until activated)"}
              </DetailItem>
              <DetailItem label="Email">
                {activated ? "Not editable" : "Organizer (until activated)"}
              </DetailItem>
              <DetailItem label="Avatar">
                {activated ? "Learner" : "Learner (after activation)"}
              </DetailItem>
              <DetailItem label="Work unit">Organizer</DetailItem>
            </div>
          </SectionCard>
        </div>

        <SectionCard
          title="Course participation"
          className="organizer-learner-courses"
        >
          {detail.status === "Deactivated" && (
            <p className="organizer-note">
              This account is deactivated. Its enrollments are kept but not
              counted in overdue statistics.
            </p>
          )}
          {detail.enrollments === null ? (
            <Alert
              type="warning"
              showIcon
              message="Couldn't load courses"
              description="Course participation is temporarily unavailable. Please try again later."
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
                    description="Not enrolled in any course"
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
        title="Learner detail"
        subtitle="Account state and Course participation."
        back
        actions={headerActions}
      />
      {renderBody()}
    </OrganizerPage>
  );
};

export default LearnerDetail;
