import { Form, Modal, Select, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
  StatusTag,
} from "@/components/organizer/organizer.ui";
import "./course.detail.scss";

type Version = {
  key: string;
  version: string;
  status: "Draft" | "Published" | "Archived";
  created: string;
  approved: string;
  learners: string;
  completed: string;
  certificates: string;
};

const versions: Version[] = [
  { key: "v3", version: "v3", status: "Draft", created: "16 Sep 2026", approved: "—", learners: "—", completed: "—", certificates: "—" },
  { key: "v2", version: "v2", status: "Published", created: "12 Jun 2026", approved: "26 Jun 2026", learners: "86", completed: "54", certificates: "54" },
  { key: "v1", version: "v1", status: "Archived", created: "01 Jan 2026", approved: "09 Jan 2026", learners: "42", completed: "42", certificates: "42" },
];

const statusTone = (status: Version["status"]) =>
  status === "Published" ? "info" : status === "Draft" ? "neutral" : "neutral";

const CourseDetail = () => {
  const { courseId } = useParams();
  const [transferOpen, setTransferOpen] = useState(false);
  const columns: ColumnsType<Version> = [
    { title: "Version", dataIndex: "version" },
    {
      title: "Status",
      dataIndex: "status",
      render: (status: Version["status"]) => (
        <StatusTag tone={statusTone(status)}>{status}</StatusTag>
      ),
    },
    { title: "Created", dataIndex: "created" },
    { title: "Approved", dataIndex: "approved" },
    { title: "Learners", dataIndex: "learners" },
    { title: "Completed", dataIndex: "completed" },
    { title: "Certificates", dataIndex: "certificates" },
  ];
  return (
    <OrganizerPage className="organizer-course-detail">
      <PageHeader
        title="Course Version Chain"
        subtitle="Workplace Safety Essentials"
        back
        actions={
          <>
            <Link to={`/organizer/courses/${courseId}/version-report`}>
              <OrganizerButton>View version report</OrganizerButton>
            </Link>
            <OrganizerButton onClick={() => setTransferOpen(true)}>
              Transfer ownership
            </OrganizerButton>
          </>
        }
      />
      <SectionCard title="Version history">
        <Table className="organizer-table" columns={columns} dataSource={versions} pagination={false} />
        <p className="organizer-note organizer-course-detail-note">
          When a new version is approved, the previous Published version
          becomes Archived. Learners already enrolled in the archived version
          continue learning and may still earn Certificates.
        </p>
      </SectionCard>
      <Modal
        className="organizer-transfer-modal"
        open={transferOpen}
        centered
        title="Transfer Course Ownership"
        onCancel={() => setTransferOpen(false)}
        footer={
          <>
            <OrganizerButton onClick={() => setTransferOpen(false)}>Cancel</OrganizerButton>
            <OrganizerButton type="primary" onClick={() => setTransferOpen(false)}>
              Transfer
            </OrganizerButton>
          </>
        }
      >
        <p>Assign Workplace Safety Essentials to another Instructor.</p>
        <Form layout="vertical" className="organizer-form">
          <Form.Item label="Current instructor">
            <strong>An Tran</strong>
          </Form.Item>
          <Form.Item label="New instructor" required>
            <Select
              placeholder="Select instructor"
              options={[
                { value: "linh-phan", label: "Linh Phan" },
                { value: "giao-le", label: "Giao Le" },
                { value: "vy-nguyen", label: "Vy Nguyen" },
              ]}
            />
          </Form.Item>
        </Form>
        <div className="organizer-approval-note">
          <strong>Transferred responsibilities</strong>
          <span>
            The new Instructor inherits all editing rights, grading
            responsibilities, and the right to invite future reviews. Any
            grading action is handled by the Instructor responsible at the
            time of processing.
          </span>
        </div>
      </Modal>
    </OrganizerPage>
  );
};

export default CourseDetail;
