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
    { title: "Criterion", dataIndex: "label", render: (value) => <strong>{value}</strong> },
    { title: "Average rating", dataIndex: "averageLabel" },
    { title: "Previous version", dataIndex: "previousVersionLabel" },
    { title: "Participation", dataIndex: "participationLabel" },
  ];

  return (
    <InstructorPage className="instructor-evaluations">
      <PageHeader
        eyebrow="INSTRUCTOR"
        title="Course Evaluation Results"
        subtitle="Anonymous feedback for your own Course versions."
        actions={
          <InstructorButton type="primary" onClick={() => navigate("/instructor/evaluations/export")}>
            Export evaluation
          </InstructorButton>
        }
      />
      <SectionCard className="instructor-evaluation-summary">
        <div>
          <span>Course</span>
          <strong>{summary.courseTitle}</strong>
        </div>
        <div>
          <span>Version</span>
          <strong>{summary.version}</strong>
        </div>
        <div>
          <span>Completed evaluations</span>
          <strong>
            {summary.completedLabel} / {summary.eligibleLabel}
          </strong>
        </div>
      </SectionCard>
      <SectionCard title="Fixed evaluation criteria">
        <Table
          className="instructor-table"
          columns={columns}
          dataSource={summary.criteria}
          pagination={false}
          rowKey="label"
        />
        <div className="instructor-evaluation-comments-link">
          <InstructorButton onClick={() => navigate("/instructor/evaluations/comments")}>
            View anonymous comments
          </InstructorButton>
        </div>
      </SectionCard>
    </InstructorPage>
  );
};

export default Evaluations;
