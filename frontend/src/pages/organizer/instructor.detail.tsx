import { Dropdown, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
  StatusTag,
  WarningPanel,
} from "@/components/organizer/organizer.ui";
import "./instructor.detail.scss";

type ManagedCourse = {
  key: string;
  course: string;
  status: "Published" | "Submitted" | "Archived";
  learners: number | string;
  violations: number;
};

const courses: ManagedCourse[] = [
  { key: "wse", course: "Workplace Safety Essentials", status: "Published", learners: 86, violations: 1 },
  { key: "ir", course: "Incident Reporting", status: "Submitted", learners: "—", violations: 0 },
  { key: "eb", course: "Equipment Basics", status: "Archived", learners: 42, violations: 0 },
];

const statusTone = (status: ManagedCourse["status"]) =>
  status === "Published" ? "info" : status === "Submitted" ? "warning" : "neutral";

const InstructorDetail = () => {
  const columns: ColumnsType<ManagedCourse> = [
    { title: "Course", dataIndex: "course" },
    {
      title: "Status",
      dataIndex: "status",
      render: (status: ManagedCourse["status"]) => (
        <StatusTag tone={statusTone(status)}>{status}</StatusTag>
      ),
    },
    { title: "Learners", dataIndex: "learners" },
    { title: "Violations", dataIndex: "violations" },
  ];
  return (
    <OrganizerPage className="organizer-instructor-detail">
      <PageHeader
        title="Instructor detail"
        subtitle="Account, assigned Courses, and confirmed violation history."
        back
        actions={
          <Dropdown
            menu={{
              items: [
                { key: "disable", label: "Disable instructor" },
                { key: "delete", label: "Delete instructor", danger: true },
              ],
            }}
          >
            <OrganizerButton>Actions</OrganizerButton>
          </Dropdown>
        }
      />
      <div className="organizer-content-grid">
        <SectionCard>
          <div className="organizer-instructor-identity">
            <h2>An Tran</h2>
            <StatusTag tone="success">Active</StatusTag>
          </div>
          <div className="organizer-detail-grid">
            <div className="organizer-detail-item">
              <span>Email</span>
              <strong>an.tran@example.com</strong>
            </div>
            <div className="organizer-detail-item">
              <span>Work unit</span>
              <strong>Engineering</strong>
            </div>
          </div>
          <p className="organizer-note">
            Organizer may edit work unit; email cannot be changed by Organizer.
          </p>
        </SectionCard>
        <SectionCard title="Subscription seat">
          <div className="organizer-usage-row">
            <div>
              <span>Seats used</span>
              <strong>18 of 25 used</strong>
            </div>
            <div className="organizer-usage">
              <span style={{ width: "72%" }} />
            </div>
          </div>
          <p className="organizer-note">
            Disabling does not free a seat. Deleting frees a seat but may
            violate auditing rules.
          </p>
        </SectionCard>
      </div>
      <SectionCard title="Courses managed" className="organizer-instructor-courses">
        <Table className="organizer-table" columns={columns} dataSource={courses} pagination={false} />
      </SectionCard>
      <WarningPanel title="Confirmed violations: 1">
        Violation count is purely business metadata. LearnUP does not
        automatically sanction an Instructor.
      </WarningPanel>
    </OrganizerPage>
  );
};

export default InstructorDetail;
