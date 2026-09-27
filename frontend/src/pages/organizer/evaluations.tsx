import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
  StatCard,
} from "@/components/organizer/organizer.ui";
import "./evaluations.scss";

type VersionRow = {
  key: string;
  version: string;
  responses: string;
  usefulness: string;
  difficulty: string;
  materials: string;
  comments: number;
};

const versionRows: VersionRow[] = [
  { key: "v2", version: "v2", responses: "39 / 54", usefulness: "4.4", difficulty: "4.1", materials: "4.3", comments: 31 },
  { key: "v1", version: "v1", responses: "26 / 42", usefulness: "4.2", difficulty: "4.0", materials: "4.1", comments: 20 },
];

const comments = [
  { key: "1", text: "The examples were practical and easy to connect to daily work.", date: "27 Sep 2026" },
  { key: "2", text: "The final Assignment was useful but Module 3 felt slightly dense.", date: "23 Sep 2026" },
  { key: "3", text: "Video quality was clear and the safety checklist was helpful.", date: "19 Sep 2026" },
  { key: "4", text: "I would like more scenario-based examples in the next version.", date: "15 Sep 2026" },
];

const Evaluations = () => {
  const columns: ColumnsType<VersionRow> = [
    { title: "Version", dataIndex: "version" },
    { title: "Responses", dataIndex: "responses" },
    { title: "Usefulness", dataIndex: "usefulness" },
    { title: "Difficulty", dataIndex: "difficulty" },
    { title: "Materials", dataIndex: "materials" },
    { title: "Comments", dataIndex: "comments" },
  ];
  return (
    <OrganizerPage className="organizer-evaluations">
      <PageHeader
        title="Course Evaluations"
        subtitle="Anonymous post-completion feedback across the Organization."
        actions={<OrganizerButton type="primary">Export results</OrganizerButton>}
      />
      <SectionCard className="organizer-evaluations-header">
        <div className="organizer-detail-grid">
          <div className="organizer-detail-item">
            <span>Course</span>
            <strong>Workplace Safety Essentials</strong>
          </div>
          <div className="organizer-detail-item">
            <span>Version</span>
            <strong>v2 · Published</strong>
          </div>
          <div className="organizer-detail-item">
            <span>Responses</span>
            <strong>39 of 54 completed Learners</strong>
          </div>
        </div>
      </SectionCard>
      <div className="organizer-stat-grid organizer-evaluations-stats">
        <StatCard label="Content usefulness" value="4.4 / 5" />
        <StatCard label="Difficulty fit" value="4.1 / 5" />
        <StatCard label="Learning material quality" value="4.3 / 5" />
        <StatCard label="Response rate" value="70%" tone="success" />
      </div>
      <SectionCard title="Version comparison">
        <Table className="organizer-table" columns={columns} dataSource={versionRows} pagination={false} />
        <p className="organizer-note organizer-evaluations-note">
          Free-text comments are anonymized; Learner identity is not
          available on this version-by-version display.
        </p>
      </SectionCard>
      <SectionCard
        title="Anonymous Comments"
        extra={<span className="organizer-note">31 anonymous comments</span>}
      >
        <div className="organizer-comments-list">
          {comments.map((comment) => (
            <div key={comment.key}>
              <div>
                <p>{comment.text}</p>
                <span>{comment.date}</span>
              </div>
              <small>Anonymous</small>
            </div>
          ))}
        </div>
        <p className="organizer-note organizer-evaluations-note">
          Learner identity is not available on this version by design.
        </p>
      </SectionCard>
    </OrganizerPage>
  );
};

export default Evaluations;
