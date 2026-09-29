import { Form, Input, message } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import {
  findContentModerationCase,
  submitReconsideration,
} from "@/components/instructor/instructor.data";
import { InfoPanel, InstructorButton, InstructorPage, PageHeader, SectionCard } from "@/components/instructor/instructor.ui";
import "./course.content.reconsider.scss";

type ReconsiderFields = { summary: string };

const CourseContentReconsider = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const item = findContentModerationCase(courseId);

  if (!item) {
    return (
      <InstructorPage className="instructor-content-reconsider">
        <PageHeader eyebrow="CONTENT REVIEW / RECONSIDERATION" title="No content review pending" subtitle="" back />
      </InstructorPage>
    );
  }

  const submit = (values: ReconsiderFields) => {
    submitReconsideration(item, values.summary);
    message.success("Reconsideration request sent.");
    navigate(`/instructor/courses/${courseId}/content-review`);
  };

  return (
    <InstructorPage className="instructor-content-reconsider">
      <PageHeader
        eyebrow="CONTENT REVIEW / RECONSIDERATION"
        title="Request Reconsideration"
        subtitle="Submit after completing the requested correction."
        back
      />
      <SectionCard>
        <span className="instructor-content-reconsider-label">Reported content</span>
        <h2>{item.reportedItemTitle}</h2>
        <Form<ReconsiderFields> layout="vertical" requiredMark={false} onFinish={submit}>
          <Form.Item
            label="Correction summary"
            name="summary"
            rules={[{ required: true, message: "Describe how the content was corrected." }]}
          >
            <Input.TextArea rows={6} placeholder="Describe how the content was corrected..." />
          </Form.Item>
          <InfoPanel title="Decision authority">
            The original decision-maker reviews this reconsideration request.
          </InfoPanel>
          <div className="instructor-content-reconsider-actions">
            <InstructorButton type="primary" htmlType="submit">
              Send for reconsideration
            </InstructorButton>
          </div>
        </Form>
      </SectionCard>
    </InstructorPage>
  );
};

export default CourseContentReconsider;
