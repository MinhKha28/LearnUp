import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useParams } from "react-router-dom";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
  StatCard,
  StatusTag,
} from "@/components/organizer/organizer.ui";
import "./report.detail.scss";

type CourseReportSummary = {
  course: string;
  enrollmentType: string;
  learning: string;
  completedOnTime: string;
  completedLate: string;
  overdue: string;
  exempt: string;
  withdrawn: string;
};

const courseReports: Record<string, CourseReportSummary> = {
  wse: { course: "Workplace Safety Essentials", enrollmentType: "Required", learning: "86", completedOnTime: "54", completedLate: "9", overdue: "8", exempt: "6", withdrawn: "0" },
  dsc: { course: "Data Security Compliance", enrollmentType: "Required", learning: "142", completedOnTime: "125", completedLate: "5", overdue: "6", exempt: "4", withdrawn: "2" },
  hrp: { course: "Harassment Prevention", enrollmentType: "Required", learning: "90", completedOnTime: "71", completedLate: "4", overdue: "9", exempt: "3", withdrawn: "3" },
  lft: { course: "Leadership Fundamentals", enrollmentType: "Optional", learning: "41", completedOnTime: "22", completedLate: "3", overdue: "0", exempt: "0", withdrawn: "1" },
};

type LearnerRow = {
  key: string;
  learner: string;
  required: string;
  due: string;
  completed: string;
  status: "In progress" | "On time" | "Completed late";
};

const rows: LearnerRow[] = [
  { key: "minh-le", learner: "Minh Le", required: "68%", due: "30 Sep", completed: "—", status: "In progress" },
  { key: "trang-nguyen", learner: "Trang Nguyen", required: "100%", due: "20 Sep", completed: "18 Sep", status: "On time" },
  { key: "bao-tran", learner: "Bao Tran", required: "100%", due: "18 Sep", completed: "21 Sep", status: "Completed late" },
];

const statusTone = (status: LearnerRow["status"]) =>
  status === "On time" ? "success" : status === "Completed late" ? "warning" : "info";

const ReportDetail = () => {
  const { reportId } = useParams();
  const summary = (reportId && courseReports[reportId]) || courseReports.wse;
  const columns: ColumnsType<LearnerRow> = [
    { title: "Learner", dataIndex: "learner" },
    { title: "Required", dataIndex: "required" },
    { title: "Due", dataIndex: "due" },
    { title: "Completed", dataIndex: "completed" },
    {
      title: "Status",
      dataIndex: "status",
      render: (status: LearnerRow["status"]) => (
        <StatusTag tone={statusTone(status)}>{status}</StatusTag>
      ),
    },
  ];
  return (
    <OrganizerPage className="organizer-report-detail">
      <PageHeader
        title="Course Report"
        subtitle="Required training status by Course."
        back
        actions={<OrganizerButton type="primary">Export report</OrganizerButton>}
      />
      <SectionCard className="organizer-report-header-card">
        <div className="organizer-detail-grid">
          <div className="organizer-detail-item">
            <span>Course</span>
            <strong>{summary.course}</strong>
          </div>
          <div className="organizer-detail-item">
            <span>Enrollment type</span>
            <strong>{summary.enrollmentType}</strong>
          </div>
        </div>
      </SectionCard>
      <div className="organizer-stat-grid organizer-report-stats">
        <StatCard label="Learning" value={summary.learning} />
        <StatCard label="Completed on time" value={summary.completedOnTime} tone="success" />
        <StatCard label="Completed late" value={summary.completedLate} tone="warning" />
        <StatCard label="Overdue" value={summary.overdue} tone="error" />
        <StatCard label="Exempt" value={summary.exempt} />
        <StatCard label="Withdrawn" value={summary.withdrawn} />
      </div>
      <SectionCard title="Learners">
        <Table className="organizer-table" columns={columns} dataSource={rows} pagination={false} />
      </SectionCard>
    </OrganizerPage>
  );
};

export default ReportDetail;
