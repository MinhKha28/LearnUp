import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useParams } from "react-router-dom";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
  StatusTag,
} from "@/components/organizer/organizer.ui";
import "./learner.report.scss";

type TrainingHistoryRow = {
  key: string;
  course: string;
  type: "Required" | "Optional";
  progress: string;
  assessment: string;
  certificate: string;
};

type LearnerReportSummary = {
  name: string;
  workUnit: string;
  status: string;
  courses: number;
  certificates: number;
  overdueCourses: number;
  history: TrainingHistoryRow[];
};

const learnerReports: Record<string, LearnerReportSummary> = {
  "minh-le": {
    name: "Minh Le",
    workUnit: "Engineering",
    status: "Active Learner",
    courses: 3,
    certificates: 1,
    overdueCourses: 1,
    history: [
      { key: "wse", course: "Workplace Safety Essentials", type: "Required", progress: "68%", assessment: "Quiz 2/3 • Assignment 1/2", certificate: "—" },
      { key: "ir", course: "Incident Reporting", type: "Required", progress: "100%", assessment: "Passed", certificate: "CERT-2026-0192" },
      { key: "lb", course: "Leadership Basics", type: "Optional", progress: "42%", assessment: "Quiz 1/2", certificate: "—" },
    ],
  },
};

const LearnerReport = () => {
  const { learnerId } = useParams();
  const summary = (learnerId && learnerReports[learnerId]) || learnerReports["minh-le"];
  const columns: ColumnsType<TrainingHistoryRow> = [
    { title: "Course", dataIndex: "course" },
    {
      title: "Type",
      dataIndex: "type",
      render: (type: TrainingHistoryRow["type"]) => (
        <StatusTag tone={type === "Required" ? "info" : "neutral"}>{type}</StatusTag>
      ),
    },
    { title: "Progress", dataIndex: "progress" },
    { title: "Assessment", dataIndex: "assessment" },
    { title: "Certificate", dataIndex: "certificate" },
  ];
  return (
    <OrganizerPage className="organizer-learner-report">
      <PageHeader
        title="Learner Report"
        subtitle="Course participation, progress, Assessment results, and Certificates."
        back
        actions={<OrganizerButton type="primary">Export report</OrganizerButton>}
      />
      <SectionCard className="organizer-learner-report-summary">
        <div className="organizer-learner-report-identity">
          <strong>{summary.name}</strong>
          <span>{summary.workUnit} • {summary.status}</span>
        </div>
        <div className="organizer-learner-report-metrics">
          <div>
            <strong>{summary.courses} Courses</strong>
          </div>
          <div>
            <strong>{summary.certificates} Certificate</strong>
          </div>
          {summary.overdueCourses > 0 && (
            <div className="organizer-learner-report-overdue">
              <strong>{summary.overdueCourses} Required Course overdue</strong>
            </div>
          )}
        </div>
      </SectionCard>
      <SectionCard title="Training history">
        <Table className="organizer-table" columns={columns} dataSource={summary.history} pagination={false} />
      </SectionCard>
    </OrganizerPage>
  );
};

export default LearnerReport;
