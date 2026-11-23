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
    { title: "Thành phần", dataIndex: "component", render: (value) => <strong>{value}</strong> },
    { title: "Mức độ hoàn thành", dataIndex: "completion" },
    { title: "Kết quả", dataIndex: "result" },
    { title: "Cần lưu ý", dataIndex: "attention" },
  ];

  if (!row) {
    return (
      <InstructorPage className="instructor-learner-progress">
        <PageHeader eyebrow="Theo dõi học tập / Học viên" title="Không tìm thấy tiến độ học viên" subtitle="" back />
      </InstructorPage>
    );
  }

  return (
    <InstructorPage className="instructor-learner-progress">
      <PageHeader
        eyebrow="Theo dõi học tập / Học viên"
        title="Tiến độ học tập của học viên"
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
        <h2>Tiến độ từng thành phần khóa học</h2>
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
