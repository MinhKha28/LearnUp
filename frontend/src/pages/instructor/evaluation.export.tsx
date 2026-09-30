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
        eyebrow="INSTRUCTOR"
        title="Export Evaluation Results"
        subtitle="Export ratings and anonymous comments for your Course."
        back
      />
      <SectionCard className="instructor-export-card">
        <h2>Scope</h2>
        <p>
          {summary.courseTitle} · Version {summary.version}
        </p>
        <p>Ratings and free-text comments without Learner identity.</p>
        <hr />
        <h3>Format</h3>
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
            Export evaluation
          </InstructorButton>
        </div>
      </SectionCard>
    </InstructorPage>
  );
};

export default EvaluationExport;
