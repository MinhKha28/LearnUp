import { Alert, Form, Input } from "antd";
import { useNavigate } from "react-router-dom";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
} from "@/components/organizer/organizer.ui";
import "./instructor.create.scss";

const InstructorCreate = () => {
  const navigate = useNavigate();
  return (
    <OrganizerPage className="organizer-instructor-create">
      <PageHeader
        title="Add Instructor"
        subtitle="Create an invitation. Organizer does not set the Instructor password."
        actions={
          <>
            <OrganizerButton onClick={() => navigate(-1)}>Cancel</OrganizerButton>
            <OrganizerButton type="primary" htmlType="submit" form="instructor-create-form">
              Send invitation
            </OrganizerButton>
          </>
        }
      />
      <SectionCard title="New Instructor">
        <Form
          id="instructor-create-form"
          className="organizer-form"
          layout="vertical"
          onFinish={() => navigate("/organizer/instructors")}
        >
          <div className="organizer-form-grid">
            <Form.Item label="Full name" name="name" rules={[{ required: true }]}>
              <Input placeholder="An Nguyen" />
            </Form.Item>
            <Form.Item label="Email" name="email" rules={[{ required: true, type: "email" }]}>
              <Input placeholder="an.nguyen@example.com" />
            </Form.Item>
            <Form.Item label="Work unit" name="workUnit" rules={[{ required: true }]}>
              <Input placeholder="Engineering" />
            </Form.Item>
            <Form.Item
              label={<span style={{ visibility: "hidden" }}>Seat check</span>}
              colon={false}
            >
              <div className="organizer-seat-check">
                <span>Seat check</span>
                <strong>7 Instructor seats available</strong>
              </div>
            </Form.Item>
          </div>
          <Alert
            type="success"
            showIcon
            message="The Instructor will receive an email and set their own password through the invitation link."
          />
        </Form>
      </SectionCard>
    </OrganizerPage>
  );
};

export default InstructorCreate;
