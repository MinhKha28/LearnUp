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
        <PageHeader eyebrow="COURSE / CONTENT REVIEW" title="No content review pending" subtitle="" back />
        <InstructorButton onClick={() => navigate(`/instructor/courses/${courseId}`)}>
          Back to Course
        </InstructorButton>
      </InstructorPage>
    );
  }

  return (
    <InstructorPage className="instructor-content-review">
      <PageHeader
        eyebrow="COURSE / CONTENT REVIEW"
        title="Content Correction Request"
        subtitle="An Organizer confirmed a report about content you own."
        back
      />
      <SectionCard>
        {item.contentDisabled && <StatusTag tone="error">Content disabled</StatusTag>}
        <h2>Reported item: {item.reportedItemTitle}</h2>
        <p className="instructor-content-review-decision">
          Decision: {item.decisionLabel} • Severity: {item.severityLabel}
        </p>
        <div className="instructor-content-review-correction">
          <strong>Correction requested</strong>
          <p>{item.correctionReason}</p>
        </div>
        {item.correctionSubmitted ? (
          <p className="instructor-content-review-note">
            Your reconsideration request was submitted and is awaiting the original decision-maker.
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
            Review content
          </InstructorButton>
          <div className="instructor-content-review-actions-right">
            <InstructorButton
              onClick={() => navigate(`/instructor/courses/${course.id}/content-review/escalate`)}
            >
              Escalate decision
            </InstructorButton>
            <InstructorButton
              type="primary"
              disabled={item.correctionSubmitted}
              onClick={() => navigate(`/instructor/courses/${course.id}/content-review/reconsider`)}
            >
              Request reconsideration
            </InstructorButton>
          </div>
        </div>
      </SectionCard>
    </InstructorPage>
  );
};

export default CourseContentReview;
