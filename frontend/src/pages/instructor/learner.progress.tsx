import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useParams } from "react-router-dom";
import {
  dueStatusMessage,
  dueStatusTone,
  findMonitoringRow,
  learnerProgressComponents,
  type ILearnerProgressComponent,
} from "@/components/instructor/instructor.data";
import { InstructorPage, PageHeader, SectionCard, StatusTag } from "@/components/instructor/instructor.ui";
import "./learner.progress.scss";

const LearnerProgress = () => {
  const { courseId, learnerId } = useParams();
  const row = findMonitoringRow(courseId, learnerId);
  const components = learnerProgressComponents(courseId ?? "", learnerId ?? "");

  const columns: ColumnsType<ILearnerProgressComponent> = [
    { title: "Component", dataIndex: "component", render: (value) => <strong>{value}</strong> },
    { title: "Completion", dataIndex: "completion" },
    { title: "Result", dataIndex: "result" },
    { title: "Attention", dataIndex: "attention" },
  ];

  if (!row) {
    return (
      <InstructorPage className="instructor-learner-progress">
        <PageHeader eyebrow="MONITORING / LEARNER" title="Learner Progress not found" subtitle="" back />
      </InstructorPage>
    );
  }

  return (
    <InstructorPage className="instructor-learner-progress">
      <PageHeader
        eyebrow="MONITORING / LEARNER"
        title="Learner Progress"
        subtitle={`Course: ${row.courseTitle} / Learner: ${row.learnerName}`}
        back
      />
      <SectionCard>
        <div className="instructor-learner-progress-status">
          <StatusTag tone="neutral">{row.enrollmentType}</StatusTag>
          <span className={`instructor-tone-${dueStatusTone[row.dueStatus]}`}>
            {dueStatusMessage[row.dueStatus]}
          </span>
        </div>
        <h2>Course component progress</h2>
        <Table
          className="instructor-table"
          columns={columns}
          dataSource={components}
          pagination={false}
          rowKey="component"
        />
      </SectionCard>
    </InstructorPage>
  );
};

export default LearnerProgress;
