import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useNavigate } from "react-router-dom";
import {
  courseEvaluationSummary,
  type IEvaluationCriterionSummary,
} from "@/components/instructor/instructor.data";
import { InstructorButton, InstructorPage, PageHeader, SectionCard } from "@/components/instructor/instructor.ui";
import "./evaluations.scss";

const Evaluations = () => {
  const navigate = useNavigate();
  const summary = courseEvaluationSummary;

  const columns: ColumnsType<IEvaluationCriterionSummary> = [
    { title: "Tiêu chí", dataIndex: "label", render: (value) => <strong>{value}</strong> },
    { title: "Điểm đánh giá trung bình", dataIndex: "averageLabel" },
    { title: "Phiên bản trước", dataIndex: "previousVersionLabel" },
    { title: "Tỷ lệ tham gia", dataIndex: "participationLabel" },
  ];

  return (
    <InstructorPage className="instructor-evaluations">
      <PageHeader
        eyebrow="Giảng viên"
        title="Kết quả đánh giá khóa học"
        subtitle="Phản hồi ẩn danh về các phiên bản khóa học bạn phụ trách."
        actions={
          <InstructorButton type="primary" onClick={() => navigate("/instructor/evaluations/export")}>
            Xuất kết quả đánh giá
          </InstructorButton>
        }
      />
      <SectionCard className="instructor-evaluation-summary">
        <div>
          <span>Khóa học</span>
          <strong>{summary.courseTitle}</strong>
        </div>
        <div>
          <span>Phiên bản</span>
          <strong>{summary.version}</strong>
        </div>
        <div>
          <span>Lượt đánh giá đã hoàn tất</span>
          <strong>
            {summary.completedLabel} / {summary.eligibleLabel}
          </strong>
        </div>
      </SectionCard>
      <SectionCard title="Bộ tiêu chí đánh giá cố định">
        <Table
          className="instructor-table"
          columns={columns}
          dataSource={summary.criteria}
          pagination={false}
          rowKey="label"
        />
        <div className="instructor-evaluation-comments-link">
          <InstructorButton onClick={() => navigate("/instructor/evaluations/comments")}>
            Xem nhận xét ẩn danh
          </InstructorButton>
        </div>
      </SectionCard>
    </InstructorPage>
  );
};

export default Evaluations;
