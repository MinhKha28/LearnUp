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
    { title: "Learner", dataIndex: "learnerName", render: (value) => <strong>{value}</strong> },
    { title: "Course", dataIndex: "courseTitle" },
    { title: "Enrollment", dataIndex: "enrollmentType" },
    { title: "Progress", dataIndex: "progressLabel" },
    { title: "Assessment", dataIndex: "resultLabel" },
    {
      title: "Due status",
      dataIndex: "dueStatus",
      render: (value: IMonitoringRow["dueStatus"]) => (
        <StatusTag tone={dueStatusTone[value]}>{value}</StatusTag>
      ),
    },
  ];

  const filterSummary = [
    monitoringFilters.courseTitle ?? "Course",
    monitoringFilters.learnerName ?? "Learner",
    monitoringFilters.enrollmentType ?? "Enrollment type",
    monitoringFilters.completionStatus ?? "Completion status",
  ];

  return (
    <InstructorPage className="instructor-monitoring">
      <PageHeader
        eyebrow="INSTRUCTOR"
        title="Course Monitoring"
        subtitle="Learning progress in Courses you currently own."
        actions={
          <InstructorButton type="primary" onClick={() => navigate("/instructor/monitoring/export")}>
            Export report
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
        {hasActiveMonitoringFilters() && <span className="instructor-monitoring-filter-active">Filtered</span>}
      </button>
      <SectionCard className="instructor-monitoring-card">
        <Table
          className="instructor-table instructor-monitoring-table"
          columns={columns}
          dataSource={rows}
          pagination={false}
          rowKey={(row) => `${row.courseId}__${row.learnerId}`}
          locale={{ emptyText: "No Learners match the current filters." }}
          onRow={(row) => ({
            onClick: () =>
              navigate(`/instructor/monitoring/courses/${row.courseId}/learners/${row.learnerId}`),
          })}
        />
        <InfoPanel title="Instructor scope">
          Only Courses currently under your responsibility appear here.
        </InfoPanel>
      </SectionCard>
    </InstructorPage>
  );
};

export default Monitoring;
