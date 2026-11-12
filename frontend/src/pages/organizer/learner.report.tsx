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
import { accountStatusText, enrollmentKindText } from "@/utils/organizer.labels";
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
    name: "Lê Minh",
    workUnit: "Kỹ thuật",
    status: "Active",
    courses: 3,
    certificates: 1,
    overdueCourses: 1,
    history: [
      { key: "wse", course: "Kiến thức cơ bản về an toàn lao động", type: "Required", progress: "68%", assessment: "Bài trắc nghiệm 2/3 • Bài tập 1/2", certificate: "—" },
      { key: "ir", course: "Báo cáo sự cố", type: "Required", progress: "100%", assessment: "Đạt", certificate: "CERT-2026-0192" },
      { key: "lb", course: "Kiến thức cơ bản về lãnh đạo", type: "Optional", progress: "42%", assessment: "Bài trắc nghiệm 1/2", certificate: "—" },
    ],
  },
};

const LearnerReport = () => {
  const { learnerId } = useParams();
  const summary = (learnerId && learnerReports[learnerId]) || learnerReports["minh-le"];
  const columns: ColumnsType<TrainingHistoryRow> = [
    { title: "Khóa học", dataIndex: "course" },
    {
      title: "Loại",
      dataIndex: "type",
      render: (type: TrainingHistoryRow["type"]) => (
        <StatusTag tone={type === "Required" ? "info" : "neutral"}>{enrollmentKindText(type)}</StatusTag>
      ),
    },
    { title: "Tiến độ", dataIndex: "progress" },
    { title: "Bài đánh giá", dataIndex: "assessment" },
    { title: "Chứng chỉ", dataIndex: "certificate" },
  ];
  return (
    <OrganizerPage className="organizer-learner-report">
      <PageHeader
        title="Báo cáo Học viên"
        subtitle="Khóa học đã tham gia, tiến độ, kết quả Bài đánh giá và Chứng chỉ."
        back
        actions={<OrganizerButton type="primary">Xuất báo cáo</OrganizerButton>}
      />
      <SectionCard className="organizer-learner-report-summary">
        <div className="organizer-learner-report-identity">
          <strong>{summary.name}</strong>
          <span>{summary.workUnit} • {accountStatusText(summary.status)}</span>
        </div>
        <div className="organizer-learner-report-metrics">
          <div>
            <strong>{summary.courses} Khóa học</strong>
          </div>
          <div>
            <strong>{summary.certificates} Chứng chỉ</strong>
          </div>
          {summary.overdueCourses > 0 && (
            <div className="organizer-learner-report-overdue">
              <strong>{summary.overdueCourses} Khóa học bắt buộc đã quá hạn</strong>
            </div>
          )}
        </div>
      </SectionCard>
      <SectionCard title="Lịch sử đào tạo">
        <Table className="organizer-table" columns={columns} dataSource={summary.history} pagination={false} />
      </SectionCard>
    </OrganizerPage>
  );
};

export default LearnerReport;
