import viVN from "antd/locale/vi_VN";
import { Alert, Button, Empty, Skeleton, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { AssignmentError } from "@/components/organizer/assignment.error";
import {
  OrganizerPage,
  PageHeader,
  SectionCard,
  StatusTag,
} from "@/components/organizer/organizer.ui";
import { useApiQuery } from "@/hooks/use.api.query";
import { fetchAssignments } from "@/services/assignment.service";
import type { Assignment } from "@/types/assignment.types";
import {
  assignmentDate,
  assignmentDue,
  assignmentProgress,
  assignmentStatus,
} from "@/utils/assignments.view";
import { parsePageParam } from "@/utils/page.param";
import "./assignments.scss";

const Assignments = () => {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const summary = (location.state as { assignmentSummary?: string } | null)
    ?.assignmentSummary;
  const page = parsePageParam(params.get("page")) ?? 1;
  const query = useApiQuery(
    (signal) => fetchAssignments(page, signal),
    [page],
    true,
  );
  const lastPage =
    query.status === "success"
      ? Math.max(1, Math.ceil(query.data.total / 20))
      : null;
  useEffect(() => {
    if (lastPage !== null && page > lastPage)
      setParams({ page: String(lastPage) }, { replace: true });
  }, [lastPage, page, setParams]);
  const timezone = query.data?.organizationTimezone ?? null;
  const columns: ColumnsType<Assignment> = [
    {
      title: "Học viên",
      key: "learner",
      render: (_, row) =>
        row.learner ? (
          <>
            <strong>{row.learner.fullName}</strong>
            <div>{row.learner.email}</div>
          </>
        ) : (
          "Không tải được thông tin"
        ),
    },
    {
      title: "Khóa học",
      key: "course",
      render: (_, row) =>
        row.course ? (
          <>
            <strong>{row.course.title}</strong>
            <div>Phiên bản {row.course.versionNumber}</div>
          </>
        ) : (
          "Không tải được thông tin"
        ),
    },
    {
      title: "Ngày phân công",
      key: "assigned",
      render: (_, row) => assignmentDate(row.assignedAt, timezone),
    },
    {
      title: "Hạn",
      key: "due",
      render: (_, row) => assignmentDue(row.dueAt, timezone),
    },
    {
      title: "Trạng thái",
      key: "status",
      render: (_, row) => (
        <StatusTag tone={assignmentStatus[row.status].tone}>
          {assignmentStatus[row.status].label}
        </StatusTag>
      ),
    },
    {
      title: "Tiến độ",
      key: "progress",
      render: (_, row) => assignmentProgress(row),
    },
    {
      title: "Thao tác",
      key: "action",
      render: (_, row) => (
        <Link to={`/organizer/assignments/${row.enrollmentId}?page=${page}`}>
          Xem chi tiết
        </Link>
      ),
    },
  ];
  return (
    <OrganizerPage className="organizer-assignments">
      {summary && <Alert type="success" showIcon message={summary} closable />}
      <PageHeader
        title="Phân công đào tạo"
        subtitle="Theo dõi các Khóa học bắt buộc trong tổ chức."
        actions={
          <Link to="/organizer/assignments/assign">
            <Button type="primary">Phân công Khóa học</Button>
          </Link>
        }
      />
      <SectionCard>
        {query.status === "error" ? (
          <AssignmentError error={query.error} retry={query.reload} />
        ) : !query.data ? (
          <Skeleton active />
        ) : query.data.total === 0 ? (
          <Empty description="Chưa có phân công Khóa học nào">
            <Link to="/organizer/assignments/assign">
              <Button type="primary">Phân công Khóa học</Button>
            </Link>
          </Empty>
        ) : (
          <Table
            rowKey="enrollmentId"
            columns={columns}
            dataSource={query.data.items}
            loading={query.status === "loading"}
            scroll={{ x: true }}
            pagination={{
              current: page,
              pageSize: 20,
              total: query.data.total,
              showSizeChanger: false,
              onChange: (value) => setParams({ page: String(value) }),
              locale: {
                ...viVN.Pagination,
                items_per_page: "/ trang",
                prev_page: "Trang trước",
                next_page: "Trang sau",
              },
            }}
          />
        )}
      </SectionCard>
    </OrganizerPage>
  );
};
export default Assignments;
