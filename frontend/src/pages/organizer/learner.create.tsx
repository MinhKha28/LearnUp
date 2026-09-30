import { Alert, Form, Input } from "antd";
import { useNavigate } from "react-router-dom";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
} from "@/components/organizer/organizer.ui";
import "./instructor.create.scss";

const LearnerCreate = () => {
  const navigate = useNavigate();
  return (
    <OrganizerPage className="organizer-instructor-create">
      <PageHeader
        title="Add Learner"
        subtitle="Create an invitation. Learner sets their own password."
        actions={
          <>
            <OrganizerButton onClick={() => navigate(-1)}>Cancel</OrganizerButton>
            <OrganizerButton type="primary" htmlType="submit" form="learner-create-form">
              Send invitation
            </OrganizerButton>
          </>
        }
      />
      <SectionCard title="New Learner">
        <Form
          id="learner-create-form"
          className="organizer-form"
          layout="vertical"
          onFinish={() => navigate("/organizer/learners")}
        >
          <div className="organizer-form-grid">
            <Form.Item label="Full name" name="name" rules={[{ required: true }]}>
              <Input placeholder="Bao Tran" />
            </Form.Item>
            <Form.Item label="Email" name="email" rules={[{ required: true, type: "email" }]}>
              <Input placeholder="bao.tran@example.com" />
            </Form.Item>
            <Form.Item label="Work unit" name="workUnit" rules={[{ required: true }]}>
              <Input placeholder="Operations" />
            </Form.Item>
            <Form.Item
              label={<span style={{ visibility: "hidden" }}>Seat check</span>}
              colon={false}
            >
              <div className="organizer-seat-check">
                <span>Seat check</span>
                <strong>182 Learner seats available</strong>
              </div>
            </Form.Item>
          </div>
          <Alert
            type="success"
            showIcon
            message="The Learner will receive an email and set their own password through the invitation link."
          />
        </Form>
      </SectionCard>
    </OrganizerPage>
  );
};

export default LearnerCreate;
