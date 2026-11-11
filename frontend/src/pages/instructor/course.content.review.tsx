import { useNavigate, useParams } from "react-router-dom";
import { findContentModerationCase, findInstructorCourse } from "@/components/instructor/instructor.data";
import {
  InstructorButton,
  InstructorPage,
  PageHeader,
  SectionCard,
  StatusTag,
} from "@/components/instructor/instructor.ui";
import "./course.content.review.scss";

const CourseContentReview = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const course = findInstructorCourse(courseId);
  const item = findContentModerationCase(courseId);

  if (!course || !item) {
    return (
      <InstructorPage className="instructor-content-review">
        <PageHeader eyebrow="Khóa học / Thẩm định nội dung" title="Không có nội dung đang chờ thẩm định" subtitle="" back />
        <InstructorButton onClick={() => navigate(`/instructor/courses/${courseId}`)}>
          Quay lại khóa học
        </InstructorButton>
      </InstructorPage>
    );
  }

  return (
    <InstructorPage className="instructor-content-review">
      <PageHeader
        eyebrow="Khóa học / Thẩm định nội dung"
        title="Yêu cầu chỉnh sửa nội dung"
        subtitle="Quản lý đào tạo đã xác nhận báo cáo liên quan đến nội dung bạn phụ trách."
        back
      />
      <SectionCard>
        {item.contentDisabled && <StatusTag tone="error">Nội dung đã bị vô hiệu hóa</StatusTag>}
        <h2>Reported item: {item.reportedItemTitle}</h2>
        <p className="instructor-content-review-decision">
          Decision: {item.decisionLabel} • Severity: {item.severityLabel}
        </p>
        <div className="instructor-content-review-correction">
          <strong>Đã yêu cầu chỉnh sửa</strong>
          <p>{item.correctionReason}</p>
        </div>
        {item.correctionSubmitted ? (
          <p className="instructor-content-review-note">
            Yêu cầu xem xét lại đã được gửi và đang chờ người đưa ra quyết định ban đầu xử lý.
          </p>
        ) : (
          <p className="instructor-content-review-note">
            Edit the permitted content and submit a reconsideration request after the correction is
            complete.
          </p>
        )}
        <div className="instructor-content-review-actions">
          <InstructorButton
            onClick={() =>
              item.lessonId
                ? navigate(`/instructor/courses/${course.id}/builder/lessons/${item.lessonId}`)
                : navigate(`/instructor/courses/${course.id}/builder`)
            }
          >
            Xem nội dung
          </InstructorButton>
          <div className="instructor-content-review-actions-right">
            <InstructorButton
              onClick={() => navigate(`/instructor/courses/${course.id}/content-review/escalate`)}
            >
              Khiếu nại quyết định
            </InstructorButton>
            <InstructorButton
              type="primary"
              disabled={item.correctionSubmitted}
              onClick={() => navigate(`/instructor/courses/${course.id}/content-review/reconsider`)}
            >
              Đề nghị xem xét lại
            </InstructorButton>
          </div>
        </div>
      </SectionCard>
    </InstructorPage>
  );
};

export default CourseContentReview;
