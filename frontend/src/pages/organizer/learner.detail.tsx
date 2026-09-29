import { Dropdown, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { Link, useParams } from "react-router-dom";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
  StatusTag,
} from "@/components/organizer/organizer.ui";
import "./learner.detail.scss";

type Participation = {
  key: string;
  course: string;
  type: "Required" | "Optional";
  progress: string;
  status: "In progress" | "Completed";
  due: string;
};

const courses: Participation[] = [
  { key: "wse", course: "Workplace Safety Essentials", type: "Required", progress: "68%", status: "In progress", due: "30 Sep 2026" },
  { key: "ir", course: "Incident Reporting", type: "Required", progress: "100%", status: "Completed", due: "20 Sep 2026" },
  { key: "lb", course: "Leadership Basics", type: "Optional", progress: "42%", status: "In progress", due: "—" },
];

const LearnerDetail = () => {
  const { learnerId } = useParams();
  const columns: ColumnsType<Participation> = [
    { title: "Course", dataIndex: "course" },
    {
      title: "Type",
      dataIndex: "type",
      render: (type: Participation["type"]) => (
        <StatusTag tone={type === "Required" ? "info" : "neutral"}>{type}</StatusTag>
      ),
    },
    { title: "Progress", dataIndex: "progress" },
    {
      title: "Status",
      dataIndex: "status",
      render: (status: Participation["status"]) => (
        <StatusTag tone={status === "Completed" ? "success" : "warning"}>{status}</StatusTag>
      ),
    },
    { title: "Due", dataIndex: "due" },
  ];
  return (
    <OrganizerPage className="organizer-learner-detail">
      <PageHeader
        title="Learner detail"
        subtitle="Account state and Course participation."
        back
        actions={
          <>
            <Link to={`/organizer/learners/${learnerId}/report`}>
              <OrganizerButton>View report</OrganizerButton>
            </Link>
            <Dropdown
              menu={{
                items: [
                  { key: "disable", label: "Disable learner" },
                  { key: "delete", label: "Delete learner", danger: true },
                ],
              }}
            >
              <OrganizerButton>Actions</OrganizerButton>
            </Dropdown>
          </>
        }
      />
      <div className="organizer-content-grid">
        <SectionCard>
          <div className="organizer-learner-identity">
            <h2>Minh Le</h2>
            <StatusTag tone="success">Active</StatusTag>
          </div>
          <div className="organizer-detail-grid">
            <div className="organizer-detail-item">
              <span>Email</span>
              <strong>minh.le@example.com</strong>
            </div>
            <div className="organizer-detail-item">
              <span>Work unit</span>
              <strong>Engineering</strong>
            </div>
          </div>
          <p className="organizer-note">
            318 / 500 Learner seats are currently used.
          </p>
        </SectionCard>
        <SectionCard title="Account rules">
          <div className="organizer-detail-grid">
            <div className="organizer-detail-item">
              <span>Disable</span>
              <strong>Keeps learning data and seat.</strong>
            </div>
            <div className="organizer-detail-item">
              <span>Delete</span>
              <strong>Frees seat; keeps results and Certificates.</strong>
            </div>
          </div>
        </SectionCard>
      </div>
      <SectionCard title="Course participation" className="organizer-learner-courses">
        <Table className="organizer-table" columns={columns} dataSource={courses} pagination={false} />
      </SectionCard>
    </OrganizerPage>
  );
};

export default LearnerDetail;
