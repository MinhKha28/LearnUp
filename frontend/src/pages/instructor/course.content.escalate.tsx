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
        <PageHeader eyebrow="Thẩm định nội dung / Khiếu nại" title="Không có nội dung đang chờ thẩm định" subtitle="" back />
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
        eyebrow="Thẩm định nội dung / Khiếu nại"
        title="Khiếu nại quyết định xử lý nội dung"
        subtitle="Khiếu nại quyết định xử lý nội dung của quản lý đào tạo đối với nội dung bạn phụ trách."
        back
      />
      <SectionCard>
        <InfoPanel title="Quy trình khiếu nại">
          Chủ sở hữu nội dung có thể khiếu nại quyết định của quản lý đào tạo.
        </InfoPanel>
        <Form<EscalateFields> layout="vertical" requiredMark={false} onFinish={submit}>
          <Form.Item
            label="Lý do khiếu nại"
            name="reason"
            rules={[{ required: true, message: "Nêu lý do cần quản trị viên xem xét lại quyết định." }]}
          >
            <Input.TextArea rows={6} placeholder="Nhập lý do đề nghị quản trị viên xem xét lại..." />
          </Form.Item>
          <div className="instructor-content-escalate-actions">
            <InstructorButton type="primary" htmlType="submit">
              Gửi quản trị viên hệ thống
            </InstructorButton>
          </div>
        </Form>
      </SectionCard>
    </InstructorPage>
  );
};

export default CourseContentEscalate;
