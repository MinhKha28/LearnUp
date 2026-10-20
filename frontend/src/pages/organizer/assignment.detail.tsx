import { Alert, Avatar, Button, Descriptions, Empty, Skeleton, Table } from "antd";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { AssignmentError } from "@/components/organizer/assignment.error";
import { AssignmentChange } from "@/components/organizer/assignment.change";
import type { AssignmentDetail as AssignmentDetailData } from "@/types/assignment.types";
import type { ApiError } from "@/types/api.types";
import { toApiError } from "@/services/api.client";
import {
  OrganizerPage,
  PageHeader,
  SectionCard,
  StatusTag,
} from "@/components/organizer/organizer.ui";
import { useApiQuery } from "@/hooks/use.api.query";
import {
  fetchAssignment,
  fetchAssignments,
} from "@/services/assignment.service";
import {
  assignmentProgress,
  assignmentStatus,
  extensionDays,
  assignmentErrorMessage,
} from "@/utils/assignments.view";
import { assignmentDateOnly, assignmentTimestamp, assignmentDueDate, assignmentDueNote } from "@/utils/assignment.date";
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
  const [updated, setUpdated] = useState<AssignmentDetailData | null>(null);
  const [listError, setListError] = useState<ApiError | null>(null);
  const [conflictError, setConflictError] = useState<ApiError | null>(null);
  const item = updated?.enrollmentId === assignmentId ? updated : query.data;
  const refreshList = () => {
    setListError(null);
    void fetchAssignments(page).catch((cause) =>
      setListError(toApiError(cause)),
    );
  };
  const timezone = item?.organizationTimezone ?? null;
  const date = (value: string | null) => assignmentTimestamp(value, timezone);
  return (
    <OrganizerPage className="organizer-assignment-detail">
      <PageHeader
        title={<span className="organizer-assignment-title">Chi tiết phân công {item && <StatusTag tone={assignmentStatus[item.status].tone}>{assignmentStatus[item.status].label}</StatusTag>}</span>}
        subtitle="Khóa học bắt buộc"
        actions={
          <>
            {item && (
              <AssignmentChange
                item={item}
                onChanged={(value) => {
                  setConflictError(null);
                  setUpdated(value);
                  refreshList();
                }}
                onConflict={(error) => {
                  setConflictError(error);
                  setUpdated(null);
                  query.reload();
                }}
              />
            )}
            <Link to={`/organizer/assignments?page=${page}`}>
              <Button>Về danh sách</Button>
            </Link>
          </>
        }
      />
      {listError && <AssignmentError error={listError} retry={refreshList} />}
      {conflictError && (
        <Alert
          type="warning"
          showIcon
          message={assignmentErrorMessage(conflictError.code)}
        />
      )}
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
          <SectionCard title="Học viên">
            {item.learner ? (
              <div className="organizer-assignment-learner">
                <div className="organizer-assignment-learner-profile">
                  <Avatar className="organizer-assignment-avatar">
                    {item.learner.fullName.trim().split(/\s+/).map(part => part[0]).slice(-2).join("").toLocaleUpperCase("vi")}
                  </Avatar>
                  <div>
                    <strong>{item.learner.fullName}</strong>
                    <div className="organizer-assignment-email">{item.learner.email}</div>
                  </div>
                </div>
                <div className="organizer-assignment-learner-account">
                  <StatusTag tone={item.learner.status === "Active" ? "success" : "neutral"}>
                    {({ Active: "Đang hoạt động", Pending: "Chờ kích hoạt", Deactivated: "Đã vô hiệu hóa" } as Record<string, string>)[item.learner.status] ?? "Không xác định"}
                  </StatusTag>
                  <span>Ngày kích hoạt: {assignmentDateOnly(item.learner.activatedAt, timezone)}</span>
                  {item.learner.deletedAt && <span>Ngày xóa tài khoản: {assignmentDateOnly(item.learner.deletedAt, timezone)}</span>}
                </div>
              </div>
            ) : <span>Không tải được thông tin</span>}
          </SectionCard>
          <SectionCard title="Thông tin phân công">
            <Descriptions
              layout="vertical"
              className="organizer-assignment-facts"
              column={{ xs: 1, md: 3 }}
              items={[
                {
                  key: "course",
                  span: 3,
                  label: "Khóa học",
                  children: item.course
                    ? <><strong>{item.course.title}</strong><span>Phiên bản {item.course.versionNumber}</span></>
                    : "Không tải được thông tin",
                },
                {
                  key: "assigned",
                  label: "Ngày phân công",
                  children: assignmentDateOnly(item.assignedAt, timezone),
                },
                {
                  key: "base",
                  label: "Hạn gốc",
                  children: assignmentDueDate(item.baseDueAt, timezone),
                },
                {
                  key: "due",
                  label: "Hạn hiện hành",
                  children: <><span>{assignmentDueDate(item.dueAt, timezone)}</span><small>{assignmentDueNote(timezone)}</small></>,
                },
                {
                  key: "extension",
                  label: "Tổng thời gian đã kéo dài",
                  children: `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 }).format(extensionDays(item.extensionSeconds))} ngày`,
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
                ...(item.completedAt ? [{
                  key: "completed",
                  label: "Ngày hoàn thành",
                  children: `${date(item.completedAt)}${item.completedLate === null ? "" : item.completedLate ? " · Trễ hạn" : " · Đúng hạn"}`,
                }] : []),
                ...(item.withdrawnAt ? [{
                  key: "withdrawn",
                  label: "Ngày rút",
                  children: date(item.withdrawnAt),
                }] : []),
                ...(item.withdrawnReason ? [{
                  key: "reason",
                  label: "Lý do rút",
                  children: item.withdrawnReason
                    ? ((
                        {
                          LearnerWithdrew: "Học viên tự rút",
                          AccountDeleted: "Tài khoản đã bị xóa",
                        } as Record<string, string>
                      )[item.withdrawnReason] ?? "Lý do khác")
                    : "—",
                }] : []),
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
