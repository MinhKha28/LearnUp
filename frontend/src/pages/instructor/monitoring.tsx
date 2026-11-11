import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useNavigate } from "react-router-dom";
import {
  dueStatusTone,
  filteredMonitoringRows,
  hasActiveMonitoringFilters,
  monitoringFilters,
  type IMonitoringRow,
} from "@/components/instructor/instructor.data";
import {
  InfoPanel,
  InstructorButton,
  InstructorPage,
  PageHeader,
  SectionCard,
  StatusTag,
} from "@/components/instructor/instructor.ui";
import "./monitoring.scss";

const Monitoring = () => {
  const navigate = useNavigate();
  const rows = filteredMonitoringRows();

  const columns: ColumnsType<IMonitoringRow> = [
    { title: "Học viên", dataIndex: "learnerName", render: (value) => <strong>{value}</strong> },
    { title: "Khóa học", dataIndex: "courseTitle" },
    { title: "Đăng ký học", dataIndex: "enrollmentType" },
    { title: "Tiến độ", dataIndex: "progressLabel" },
    { title: "Bài đánh giá", dataIndex: "resultLabel" },
    {
      title: "Trạng thái hạn học",
      dataIndex: "dueStatus",
      render: (value: IMonitoringRow["dueStatus"]) => (
        <StatusTag tone={dueStatusTone[value]}>{value}</StatusTag>
      ),
    },
  ];

  const filterSummary = [
    monitoringFilters.courseTitle ?? "Khóa học",
    monitoringFilters.learnerName ?? "Học viên",
    monitoringFilters.enrollmentType ?? "Hình thức đăng ký học",
    monitoringFilters.completionStatus ?? "Trạng thái hoàn thành",
  ];

  return (
    <InstructorPage className="instructor-monitoring">
      <PageHeader
        eyebrow="Giảng viên"
        title="Theo dõi học tập"
        subtitle="Theo dõi tiến độ học tập tại các khóa học bạn đang phụ trách."
        actions={
          <InstructorButton type="primary" onClick={() => navigate("/instructor/monitoring/export")}>
            Xuất báo cáo
          </InstructorButton>
        }
      />
      <button
        type="button"
        className="instructor-monitoring-filter-bar"
        onClick={() => navigate("/instructor/monitoring/filters")}
      >
        {filterSummary.map((label, index) => (
          <span key={label + index}>
            {label}
            {index < filterSummary.length - 1 && <em>›</em>}
          </span>
        ))}
        {hasActiveMonitoringFilters() && <span className="instructor-monitoring-filter-active">Đã lọc</span>}
      </button>
      <SectionCard className="instructor-monitoring-card">
        <Table
          className="instructor-table instructor-monitoring-table"
          columns={columns}
          dataSource={rows}
          pagination={false}
          rowKey={(row) => `${row.courseId}__${row.learnerId}`}
          locale={{ emptyText: "Không tìm thấy học viên phù hợp với bộ lọc hiện tại." }}
          onRow={(row) => ({
            onClick: () =>
              navigate(`/instructor/monitoring/courses/${row.courseId}/learners/${row.learnerId}`),
          })}
        />
        <InfoPanel title="Phạm vi giảng viên">
          Chỉ hiển thị các khóa học bạn đang phụ trách.
        </InfoPanel>
      </SectionCard>
    </InstructorPage>
  );
};

export default Monitoring;
