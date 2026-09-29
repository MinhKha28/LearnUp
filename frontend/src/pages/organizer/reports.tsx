import { FilterOutlined } from "@ant-design/icons";
import { Select, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useNavigate } from "react-router-dom";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  ProgressLine,
  SectionCard,
  StatCard,
  StatusTag,
} from "@/components/organizer/organizer.ui";
import "./reports.scss";

type CourseReportRow = {
  key: string;
  course: string;
  enrollmentType: "Required" | "Optional";
  learners: number;
  completion: string;
  overdue: number;
};

const courseRows: CourseReportRow[] = [
  { key: "wse", course: "Workplace Safety Essentials", enrollmentType: "Required", learners: 86, completion: "63%", overdue: 8 },
  { key: "dsc", course: "Data Security Compliance", enrollmentType: "Required", learners: 142, completion: "88%", overdue: 6 },
  { key: "hrp", course: "Harassment Prevention", enrollmentType: "Required", learners: 90, completion: "79%", overdue: 9 },
  { key: "lft", course: "Leadership Fundamentals", enrollmentType: "Optional", learners: 41, completion: "54%", overdue: 0 },
];

const Reports = () => {
  const navigate = useNavigate();
  const courseColumns: ColumnsType<CourseReportRow> = [
    { title: "Course", dataIndex: "course" },
    { title: "Enrollment type", dataIndex: "enrollmentType" },
    { title: "Learners", dataIndex: "learners" },
    { title: "Completion", dataIndex: "completion" },
    {
      title: "Overdue",
      dataIndex: "overdue",
      render: (value: number) => (
        <StatusTag tone={value > 0 ? "error" : "success"}>{value}</StatusTag>
      ),
    },
    {
      title: "",
      key: "action",
      align: "right",
      render: (_, item) => (
        <button
          className="organizer-link"
          onClick={() => navigate(`/organizer/reports/${item.key}`)}
        >
          View report →
        </button>
      ),
    },
  ];
  return (
    <OrganizerPage className="organizer-reports">
      <PageHeader
        title="Training Reports"
        subtitle="Organization-wide training reporting with Required completion separated from Optional learning."
        actions={
          <>
            <OrganizerButton>Export PDF</OrganizerButton>
            <OrganizerButton type="primary">Export Excel</OrganizerButton>
          </>
        }
      />
      <div className="organizer-stat-grid organizer-reports-stats">
        <StatCard label="Learners" value="318" />
        <StatCard label="Courses in delivery" value="14" />
        <StatCard label="Required completion" value="82%" tone="success" />
        <StatCard label="Certificates issued" value="196" />
        <StatCard label="Overdue" value="23" tone="error" />
      </div>
      <SectionCard className="organizer-reports-filters">
        <div className="organizer-reports-filter-bar">
          <span className="organizer-reports-filter-label">
            <FilterOutlined />
            Filters
          </span>
          <Select
            variant="borderless"
            placeholder="Date range"
            popupMatchSelectWidth={false}
            options={[{ value: "30", label: "Last 30 days" }, { value: "90", label: "Last 90 days" }]}
          />
          <Select
            variant="borderless"
            placeholder="Course"
            popupMatchSelectWidth={false}
            options={courseRows.map((item) => ({ value: item.key, label: item.course }))}
          />
          <Select
            variant="borderless"
            placeholder="Enrollment type"
            popupMatchSelectWidth={false}
            options={[{ value: "required", label: "Required" }, { value: "optional", label: "Optional" }]}
          />
          <Select
            variant="borderless"
            placeholder="Work unit"
            popupMatchSelectWidth={false}
            options={[{ value: "all", label: "All work units" }]}
          />
          <Select
            variant="borderless"
            placeholder="Completion status"
            popupMatchSelectWidth={false}
            options={[{ value: "on-time", label: "Completed on time" }, { value: "overdue", label: "Overdue" }]}
          />
          <Select
            variant="borderless"
            placeholder="Certificate ID"
            popupMatchSelectWidth={false}
            options={[]}
          />
        </div>
      </SectionCard>
      <SectionCard title="Courses" className="organizer-reports-courses">
        <Table
          className="organizer-table"
          columns={courseColumns}
          dataSource={courseRows}
          pagination={false}
        />
      </SectionCard>
      <div className="organizer-content-grid">
        <SectionCard title="Required compliance">
          <div className="organizer-dashboard-progress">
            <ProgressLine label="Completed on time" count="204" value={64} />
            <ProgressLine label="Late completion" count="36" value={11} tone="amber" />
            <ProgressLine label="Overdue" count="23" value={7} tone="red" />
            <ProgressLine label="Exempt" count="12" value={4} tone="blue" />
          </div>
        </SectionCard>
        <SectionCard title="Optional learning">
          <p className="organizer-note">
            Voluntary learning does not affect compliance.
          </p>
          <div className="organizer-metric-row organizer-optional-metrics">
            <div className="organizer-metric">
              <span>Active Optional enrollments</span>
              <strong>74</strong>
            </div>
            <div className="organizer-metric">
              <span>Optional completions</span>
              <strong>41</strong>
            </div>
            <div className="organizer-metric">
              <span>Withdrawn Optional</span>
              <strong>9</strong>
            </div>
          </div>
        </SectionCard>
      </div>
    </OrganizerPage>
  );
};

export default Reports;
