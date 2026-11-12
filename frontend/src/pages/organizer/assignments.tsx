import viVN from "antd/locale/vi_VN";
import { Button, Empty, Skeleton, Table, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { InfoCircleOutlined } from "@ant-design/icons";
import { assignmentDateOnly, assignmentDueDate, assignmentDueNote } from "@/utils/assignment.date";
import { useEffect } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { AssignmentFilterBar } from "@/components/organizer/assignment.filters";
import { AssignmentError } from "@/components/organizer/assignment.error";
import {
  OrganizerPage,
  PageHeader,
  SectionCard,
  StatusTag,
} from "@/components/organizer/organizer.ui";
import { useApiQuery } from "@/hooks/use.api.query";
import { fetchAssignments } from "@/services/assignment.service";
import type { Assignment, AssignmentFilters } from "@/types/assignment.types";
import {
  assignmentStatus,
} from "@/utils/assignments.view";
import { parsePageParam } from "@/utils/page.param";
import "./assignments.scss";
import { VietnameseAlert, vietnamesePageItem } from "@/components/vietnamese.controls";

const Assignments = () => {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const summary = (location.state as { assignmentSummary?: string } | null)
    ?.assignmentSummary;
  const page = parsePageParam(params.get("page")) ?? 1;
  const filters: AssignmentFilters = {
    learner: params.get("learner") ?? undefined,
    course: params.get("course") ?? undefined,
    status: (params.get("status") as AssignmentFilters["status"]) ?? undefined,
    dueFrom: params.get("dueFrom") ?? undefined,
    dueTo: params.get("dueTo") ?? undefined,
  };
  const filterKey = JSON.stringify(filters);
  const hasFilters = Object.values(filters).some((value) => value !== undefined);
  const applyFilters = (next: AssignmentFilters) => {
    const search = new URLSearchParams({ page: "1" });
    for (const [name, value] of Object.entries(next)) {
      if (value) search.set(name, value);
    }
    if (search.toString() === params.toString()) query.reload();
    else setParams(search);
  };
  const clearFilters = () => applyFilters({});
  const query = useApiQuery(
    (signal) => fetchAssignments(page, filters, signal),
    [page, filterKey],
    true,
  );
  const lastPage =
    query.status === "success"
      ? Math.max(1, Math.ceil(query.data.total / 20))
      : null;
  useEffect(() => {
    if (lastPage !== null && page > lastPage)
      setParams((current) => {
        const next = new URLSearchParams(current);
        next.set("page", String(lastPage));
        return next;
      }, { replace: true });
  }, [lastPage, page, setParams]);
  const columns: ColumnsType<Assignment> = [
    {
      title: "Học viên",
      key: "learner",
      className: "organizer-assignment-flex",
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
      className: "organizer-assignment-flex",
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
      className: "organizer-assignment-nowrap",
      width: "1%",
      render: (_, row) => assignmentDateOnly(row.assignedAt, row.dueTimezone),
    },
    {
      title: "Hạn",
      key: "due",
      className: "organizer-assignment-nowrap",
      width: "1%",
      render: (_, row) => <Tooltip title={assignmentDueNote(row.dueTimezone, row.dueAt)}><span>{assignmentDueDate(row.dueAt, row.dueTimezone)}</span></Tooltip>,
    },
    {
      title: "Trạng thái",
      key: "status",
      className: "organizer-assignment-nowrap",
      width: "1%",
      render: (_, row) => (
        <StatusTag tone={assignmentStatus[row.status].tone}>
          {assignmentStatus[row.status].label}
        </StatusTag>
      ),
    },
    {
      title: <span className="organizer-assignment-column-title">Tiến độ <Tooltip title="Số học liệu bắt buộc đã hoàn thành"><InfoCircleOutlined role="img" aria-label="Số học liệu bắt buộc đã hoàn thành" tabIndex={0} /></Tooltip></span>,
      key: "progress",
      className: "organizer-assignment-nowrap",
      width: "1%",
      render: (_, row) => row.requiredTotal > 0 ? `${row.requiredCompleted}/${row.requiredTotal} học liệu` : null,
    },
    {
      title: "Thao tác",
      key: "action",
      className: "organizer-assignment-nowrap",
      width: "1%",
      render: (_, row) => (
        <Link to={`/organizer/assignments/${row.enrollmentId}?page=${page}`} state={{ assignmentListSearch: params.toString() }}>
          Xem chi tiết
        </Link>
      ),
    },
  ];
  return (
    <OrganizerPage className="organizer-assignments">
      {summary && <VietnameseAlert type="success" showIcon message={summary} closable />}
      <PageHeader
        title="Phân công đào tạo"
        subtitle="Theo dõi các khóa học bắt buộc trong tổ chức."
        actions={
          <Link to="/organizer/assignments/assign">
            <Button type="primary">Phân công khóa học</Button>
          </Link>
        }
      />
      <SectionCard>
        <AssignmentFilterBar key={filterKey} filters={filters} apply={applyFilters} clear={clearFilters} />
        {query.status === "error" ? (
          query.error.status === 400 && query.error.code !== "INVALID_DUE_DATE_RANGE" ? (
            <VietnameseAlert type="error" showIcon message="Bộ lọc không hợp lệ. Vui lòng kiểm tra từ khóa, tình trạng và ngày." />
          ) : (
            <AssignmentError
              error={query.error}
              retry={query.error.status === 400 || query.error.code === "SEARCH_TOO_BROAD" ? undefined : query.reload}
            />
          )
        ) : !query.data ? (
          <Skeleton active />
        ) : query.status === "success" && query.data.total === 0 && hasFilters ? (
          <Empty description="Không có phân công phù hợp với bộ lọc">
            <Button onClick={clearFilters}>Xóa bộ lọc</Button>
          </Empty>
        ) : query.status === "success" && query.data.total === 0 ? (
          <Empty description="Chưa có phân công khóa học nào">
            <Link to="/organizer/assignments/assign">
              <Button type="primary">Phân công khóa học</Button>
            </Link>
          </Empty>
        ) : (
          <Table
            rowKey="enrollmentId"
            columns={columns}
            dataSource={query.data.items}
            loading={query.status === "loading"}
            scroll={{ x: 760 }}
            pagination={{
              itemRender: vietnamesePageItem,
              current: page,
              pageSize: 20,
              total: query.data.total,
              showSizeChanger: false,
              onChange: (value) => {
                const next = new URLSearchParams(params);
                next.set("page", String(value));
                setParams(next);
              },
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
