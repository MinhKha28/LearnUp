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
        <PageHeader eyebrow="Thẩm định nội dung / Đề nghị xem xét lại" title="Không có nội dung đang chờ thẩm định" subtitle="" back />
      </InstructorPage>
    );
  }

  const submit = (values: ReconsiderFields) => {
    submitReconsideration(item, values.summary);
    message.success("Đã gửi yêu cầu xem xét lại.");
    navigate(`/instructor/courses/${courseId}/content-review`);
  };

  return (
    <InstructorPage className="instructor-content-reconsider">
      <PageHeader
        eyebrow="Thẩm định nội dung / Đề nghị xem xét lại"
        title="Đề nghị xem xét lại"
        subtitle="Gửi đề nghị sau khi hoàn tất nội dung cần chỉnh sửa."
        back
      />
      <SectionCard>
        <span className="instructor-content-reconsider-label">Nội dung bị báo cáo</span>
        <h2>{item.reportedItemTitle}</h2>
        <Form<ReconsiderFields> layout="vertical" requiredMark={false} onFinish={submit}>
          <Form.Item
            label="Tóm tắt nội dung đã sửa"
            name="summary"
            rules={[{ required: true, message: "Mô tả cách bạn đã khắc phục nội dung." }]}
          >
            <Input.TextArea rows={6} placeholder="Nhập nội dung đã khắc phục..." />
          </Form.Item>
          <InfoPanel title="Thẩm quyền quyết định">
            Người đưa ra quyết định ban đầu sẽ xem xét yêu cầu này.
          </InfoPanel>
          <div className="instructor-content-reconsider-actions">
            <InstructorButton type="primary" htmlType="submit">
              Gửi yêu cầu xem xét lại
            </InstructorButton>
          </div>
        </Form>
      </SectionCard>
    </InstructorPage>
  );
};

export default CourseContentReconsider;
