import { Form, Input, message } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import {
  escalateContentDecision,
  findContentModerationCase,
} from "@/components/instructor/instructor.data";
import { InfoPanel, InstructorButton, InstructorPage, PageHeader, SectionCard } from "@/components/instructor/instructor.ui";
import "./course.content.escalate.scss";

type EscalateFields = { reason: string };

const CourseContentEscalate = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const item = findContentModerationCase(courseId);

  if (!item) {
    return (
      <InstructorPage className="instructor-content-escalate">
        <PageHeader eyebrow="CONTENT REVIEW / ESCALATION" title="No content review pending" subtitle="" back />
      </InstructorPage>
    );
  }

  const submit = (values: EscalateFields) => {
    escalateContentDecision(item, values.reason);
    message.success("Escalation sent to the platform Admin.");
    navigate(`/instructor/courses/${courseId}/content-review`);
  };

  return (
    <InstructorPage className="instructor-content-escalate">
      <PageHeader
        eyebrow="CONTENT REVIEW / ESCALATION"
        title="Escalate Content Decision"
        subtitle="Contest an Organizer decision about content you own."
        back
      />
      <SectionCard>
        <InfoPanel title="Appeal route">
          This is for the content owner to challenge an Organizer decision.
        </InfoPanel>
        <Form<EscalateFields> layout="vertical" requiredMark={false} onFinish={submit}>
          <Form.Item
            label="Reason for escalation"
            name="reason"
            rules={[{ required: true, message: "Explain why the decision should be reviewed by Admin." }]}
          >
            <Input.TextArea rows={6} placeholder="Explain why the decision should be reviewed by Admin..." />
          </Form.Item>
          <div className="instructor-content-escalate-actions">
            <InstructorButton type="primary" htmlType="submit">
              Send to platform Admin
            </InstructorButton>
          </div>
        </Form>
      </SectionCard>
    </InstructorPage>
  );
};

export default CourseContentEscalate;
