import { anonymousEvaluationComments } from "@/components/instructor/instructor.data";
import { InfoPanel, InstructorPage, PageHeader, SectionCard } from "@/components/instructor/instructor.ui";
import "./evaluation.comments.scss";

const EvaluationComments = () => (
  <InstructorPage className="instructor-evaluation-comments">
    <PageHeader
      eyebrow="Đánh giá khóa học / Nhận xét"
      title="Nhận xét ẩn danh"
      subtitle="Nhận xét về khóa học không gắn danh tính học viên."
      back
    />
    <InfoPanel title="Bảo mật danh tính">Nội dung nhận xét không gắn với danh tính học viên.</InfoPanel>
    <SectionCard className="instructor-evaluation-comments-card">
      {anonymousEvaluationComments.map((comment, index) => (
        <div className="instructor-evaluation-comment" key={index}>
          <span>Anonymous comment</span>
          <p>{comment}</p>
        </div>
      ))}
    </SectionCard>
  </InstructorPage>
);

export default EvaluationComments;
