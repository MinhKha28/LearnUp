import { Button, Descriptions, Empty, Skeleton, Table } from "antd";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { AssignmentError } from "@/components/organizer/assignment.error";
import {
  OrganizerPage,
  PageHeader,
  SectionCard,
  StatusTag,
} from "@/components/organizer/organizer.ui";
import { useApiQuery } from "@/hooks/use.api.query";
import { fetchAssignment } from "@/services/assignment.service";
import {
  assignmentDate,
  assignmentDue,
  assignmentProgress,
  assignmentStatus,
  extensionDays,
} from "@/utils/assignments.view";
import { parsePageParam } from "@/utils/page.param";
import "./assignment.detail.scss";

const AssignmentDetail = () => {
  const { assignmentId = "" } = useParams();
  const [params] = useSearchParams();
  const page = parsePageParam(params.get("page")) ?? 1;
  const query = useApiQuery(
    (signal) => fetchAssignment(assignmentId, signal),
    [assignmentId],
  );
  const item = query.data;
  const timezone = item?.organizationTimezone ?? null;
  const date = (value: string | null) => assignmentDate(value, timezone);
  return (
    <OrganizerPage className="organizer-assignment-detail">
      <PageHeader
        title="Chi tiết phân công"
        subtitle="Course bắt buộc"
        actions={
          <Link to={`/organizer/assignments?page=${page}`}>
            <Button>Về danh sách</Button>
          </Link>
        }
      />
      {query.status === "error" ? (
        <AssignmentError
          error={query.error}
          retry={
            query.error.code === "ASSIGNMENT_NOT_FOUND"
              ? undefined
              : query.reload
          }
        />
      ) : !item ? (
        <Skeleton active />
      ) : (
        <>
          <SectionCard title="Thông tin phân công">
            <Descriptions
              column={{ xs: 1, md: 2 }}
              items={[
                {
                  key: "learner",
                  label: "Learner",
                  children: item.learner ? (
                    <>
                      <strong>{item.learner.fullName}</strong>
                      <div>{item.learner.email}</div>
                      <div>
                        Trạng thái tài khoản:{" "}
                        {(
                          {
                            Active: "Đang hoạt động",
                            Pending: "Chờ kích hoạt",
                            Deactivated: "Đã vô hiệu hóa",
                          } as Record<string, string>
                        )[item.learner.status] ?? "Không xác định"}
                      </div>
                      <div>Kích hoạt: {date(item.learner.activatedAt)}</div>
                      <div>Xóa tài khoản: {date(item.learner.deletedAt)}</div>
                    </>
                  ) : (
                    "Không tải được thông tin"
                  ),
                },
                {
                  key: "course",
                  label: "Course",
                  children: item.course
                    ? `${item.course.title} · Phiên bản ${item.course.versionNumber}`
                    : "Không tải được thông tin",
                },
                {
                  key: "assigned",
                  label: "Ngày phân công",
                  children: date(item.assignedAt),
                },
                {
                  key: "base",
                  label: "Hạn gốc",
                  children: assignmentDue(item.baseDueAt, timezone),
                },
                {
                  key: "extension",
                  label: "Tổng thời gian đã kéo dài",
                  children: `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 }).format(extensionDays(item.extensionSeconds))} ngày`,
                },
                {
                  key: "due",
                  label: "Hạn hiện hành",
                  children: assignmentDue(item.dueAt, timezone),
                },
                {
                  key: "status",
                  label: "Trạng thái",
                  children: (
                    <StatusTag tone={assignmentStatus[item.status].tone}>
                      {assignmentStatus[item.status].label}
                    </StatusTag>
                  ),
                },
                ...(item.requiredTotal > 0
                  ? [
                      {
                        key: "progress",
                        label: "Tiến độ",
                        children: assignmentProgress(item),
                      },
                    ]
                  : []),
                {
                  key: "first",
                  label: "Hoạt động đầu tiên",
                  children: date(item.firstActivityAt),
                },
                {
                  key: "completed",
                  label: "Hoàn thành",
                  children: `${date(item.completedAt)}${item.completedLate === null ? "" : item.completedLate ? " · Trễ hạn" : " · Đúng hạn"}`,
                },
                {
                  key: "withdrawn",
                  label: "Thời điểm rút",
                  children: date(item.withdrawnAt),
                },
                {
                  key: "reason",
                  label: "Lý do rút",
                  children: item.withdrawnReason
                    ? ((
                        {
                          LearnerWithdrew: "Learner tự rút",
                          AccountDeleted: "Tài khoản đã bị xóa",
                        } as Record<string, string>
                      )[item.withdrawnReason] ?? "Lý do khác")
                    : "—",
                },
              ]}
            />
          </SectionCard>
          <SectionCard title="Các khoảng Miễn / Tạm dừng">
            <Table
              rowKey={(_, index) => String(index)}
              dataSource={item.intervals}
              pagination={false}
              scroll={{ x: true }}
              locale={{
                emptyText: (
                  <Empty description="Chưa có khoảng Miễn / Tạm dừng" />
                ),
              }}
              columns={[
                {
                  title: "Loại",
                  dataIndex: "kind",
                  render: (kind: string) =>
                    kind === "Exempted" ? "Miễn" : "Tạm dừng",
                },
                { title: "Bắt đầu", dataIndex: "startedAt", render: date },
                {
                  title: "Kết thúc",
                  dataIndex: "endedAt",
                  render: (value: string | null) =>
                    value ? date(value) : "Đang áp dụng",
                },
                {
                  title: "Lý do",
                  dataIndex: "reason",
                  render: (value: string | null) => (
                    <span className="organizer-assignment-reason">
                      {value ?? "—"}
                    </span>
                  ),
                },
              ]}
            />
          </SectionCard>
        </>
      )}
    </OrganizerPage>
  );
};
export default AssignmentDetail;
