import { useState } from "react";
import { message } from "antd";
import { useNavigate } from "react-router-dom";
import { courseEvaluationSummary } from "@/components/instructor/instructor.data";
import { InstructorButton, InstructorPage, PageHeader, SectionCard } from "@/components/instructor/instructor.ui";
import "./monitoring.export.scss";

type ExportFormat = "Excel" | "PDF";

const EvaluationExport = () => {
  const navigate = useNavigate();
  const [format, setFormat] = useState<ExportFormat>("Excel");
  const summary = courseEvaluationSummary;

  const exportEvaluation = () => {
    message.success(`Evaluation results exported as ${format}.`);
    navigate("/instructor/evaluations");
  };

  return (
    <InstructorPage className="instructor-evaluation-export">
      <PageHeader
        eyebrow="Giảng viên"
        title="Xuất kết quả đánh giá khóa học"
        subtitle="Xuất điểm đánh giá và nhận xét ẩn danh của khóa học."
        back
      />
      <SectionCard className="instructor-export-card">
        <h2>Phạm vi</h2>
        <p>
          {summary.courseTitle} · Version {summary.version}
        </p>
        <p>Điểm đánh giá và nhận xét không gắn danh tính học viên.</p>
        <hr />
        <h3>Định dạng</h3>
        <div className="instructor-export-formats">
          {(["Excel", "PDF"] as ExportFormat[]).map((option) => (
            <button
              key={option}
              type="button"
              className={`instructor-export-format ${format === option ? "instructor-export-format-active" : ""}`}
              onClick={() => setFormat(option)}
            >
              {option}
            </button>
          ))}
        </div>
        <div className="instructor-export-actions">
          <InstructorButton type="primary" onClick={exportEvaluation}>
            Xuất kết quả đánh giá
          </InstructorButton>
        </div>
      </SectionCard>
    </InstructorPage>
  );
};

export default EvaluationExport;
