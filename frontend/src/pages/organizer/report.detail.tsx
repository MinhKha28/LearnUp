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
import { enrollmentKindText } from "@/utils/organizer.labels";
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
  wse: { course: "Kiến thức cơ bản về an toàn lao động", enrollmentType: "Required", learning: "86", completedOnTime: "54", completedLate: "9", overdue: "8", exempt: "6", withdrawn: "0" },
  dsc: { course: "Tuân thủ bảo mật dữ liệu", enrollmentType: "Required", learning: "142", completedOnTime: "125", completedLate: "5", overdue: "6", exempt: "4", withdrawn: "2" },
  hrp: { course: "Phòng chống quấy rối", enrollmentType: "Required", learning: "90", completedOnTime: "71", completedLate: "4", overdue: "9", exempt: "3", withdrawn: "3" },
  lft: { course: "Kiến thức nền tảng về lãnh đạo", enrollmentType: "Optional", learning: "41", completedOnTime: "22", completedLate: "3", overdue: "0", exempt: "0", withdrawn: "1" },
};

type LearnerRow = {
  key: string;
  learner: string;
  required: string;
  due: string;
  completed: string;
  status: "InProgress" | "OnTime" | "CompletedLate";
};

const rows: LearnerRow[] = [
  { key: "minh-le", learner: "Lê Minh", required: "68%", due: "30/09", completed: "—", status: "InProgress" },
  { key: "trang-nguyen", learner: "Trang Nguyễn", required: "100%", due: "20/09", completed: "18/09", status: "OnTime" },
  { key: "bao-tran", learner: "Bảo Trần", required: "100%", due: "18/09", completed: "21/09", status: "CompletedLate" },
];

const learnerProgressText: Record<LearnerRow["status"], string> = {
  InProgress: "Đang học",
  OnTime: "Hoàn thành đúng hạn",
  CompletedLate: "Hoàn thành trễ hạn",
};

const statusTone = (status: LearnerRow["status"]) =>
  status === "OnTime" ? "success" : status === "CompletedLate" ? "warning" : "info";

const ReportDetail = () => {
  const { reportId } = useParams();
  const summary = (reportId && courseReports[reportId]) || courseReports.wse;
  const columns: ColumnsType<LearnerRow> = [
    { title: "Học viên", dataIndex: "learner" },
    { title: "Bắt buộc", dataIndex: "required" },
    { title: "Hạn hoàn thành", dataIndex: "due" },
    { title: "Đã hoàn thành", dataIndex: "completed" },
    {
      title: "Trạng thái",
      dataIndex: "status",
      render: (status: LearnerRow["status"]) => (
        <StatusTag tone={statusTone(status)}>{learnerProgressText[status]}</StatusTag>
      ),
    },
  ];
  return (
    <OrganizerPage className="organizer-report-detail">
      <PageHeader
        title="Báo cáo Khóa học"
        subtitle="Trạng thái đào tạo bắt buộc theo Khóa học."
        back
        actions={<OrganizerButton type="primary">Xuất báo cáo</OrganizerButton>}
      />
      <SectionCard className="organizer-report-header-card">
        <div className="organizer-detail-grid">
          <div className="organizer-detail-item">
            <span>Khóa học</span>
            <strong>{summary.course}</strong>
          </div>
          <div className="organizer-detail-item">
            <span>Hình thức tham gia</span>
            <strong>{enrollmentKindText(summary.enrollmentType)}</strong>
          </div>
        </div>
      </SectionCard>
      <div className="organizer-stat-grid organizer-report-stats">
        <StatCard label="Đang học" value={summary.learning} />
        <StatCard label="Hoàn thành đúng hạn" value={summary.completedOnTime} tone="success" />
        <StatCard label="Hoàn thành trễ hạn" value={summary.completedLate} tone="warning" />
        <StatCard label="Quá hạn" value={summary.overdue} tone="error" />
        <StatCard label="Được miễn" value={summary.exempt} />
        <StatCard label="Đã rút" value={summary.withdrawn} />
      </div>
      <SectionCard title="Học viên">
        <Table className="organizer-table" columns={columns} dataSource={rows} pagination={false} />
      </SectionCard>
    </OrganizerPage>
  );
};

export default ReportDetail;
