import { message } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import {
  canSubmitCourse,
  courseStatusLabel,
  findInstructorCourse,
  submitCourseForApproval,
} from "@/components/instructor/instructor.data";
import {
  InstructorButton,
  InstructorPage,
  PageHeader,
  SectionCard,
} from "@/components/instructor/instructor.ui";
import "./course.submit.scss";

const reviewRows = [
  { title: "Course details", description: "Name, objectives, type and planned days" },
  { title: "Curriculum", description: "Modules, Lessons and required flags" },
  { title: "Resources", description: "Video and Reading files" },
  { title: "Assessments", description: "Quiz and Assignment with mandatory Rubric" },
];

const CourseSubmit = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const course = findInstructorCourse(courseId);

  if (!course) {
    return (
      <InstructorPage className="instructor-course-submit">
        <PageHeader
          eyebrow="COURSE / APPROVAL"
          title="Course not found"
          subtitle="This Course may have been removed."
          back
        />
        <InstructorButton onClick={() => navigate("/instructor/courses")}>
          Back to My Courses
        </InstructorButton>
      </InstructorPage>
    );
  }

  if (!canSubmitCourse(course)) {
    return (
      <InstructorPage className="instructor-course-submit">
        <PageHeader
          eyebrow="COURSE / APPROVAL"
          title="Course cannot be submitted"
          subtitle={`This Course is currently ${courseStatusLabel[course.status]}.`}
          back
        />
        <InstructorButton onClick={() => navigate(`/instructor/courses/${course.id}`)}>
          Back to Course
        </InstructorButton>
      </InstructorPage>
    );
  }

  const isResubmit = course.status === "rejected";

  const handleReview = (section: string) => message.info(`${section} opens in the Course Builder.`);

  const handleSubmit = () => {
    submitCourseForApproval(course);
    message.success(isResubmit ? "Course resubmitted." : "Course submitted.");
    navigate(`/instructor/courses/${course.id}/submitted`);
  };

  return (
    <InstructorPage className="instructor-course-submit">
      <PageHeader
        eyebrow="COURSE / APPROVAL"
        title="Review and Submit Course"
        subtitle="Review Course content before sending it to the Organizer."
        back
      />
      <div className="instructor-submit-grid">
        <SectionCard className="instructor-submit-main">
          <h2 className="instructor-submit-heading">
            {course.title} • {courseStatusLabel[course.status]}
          </h2>
          <div className="instructor-submit-rows">
            {reviewRows.map((row) => (
              <div className="instructor-submit-row" key={row.title}>
                <div>
                  <strong>{row.title}</strong>
                  <p>{row.description}</p>
                </div>
                <button
                  type="button"
                  className="instructor-submit-review-link"
                  onClick={() => handleReview(row.title)}
                >
                  Review
                </button>
              </div>
            ))}
          </div>
          <div className="instructor-submit-warning">
            <strong>Estimated duration check</strong>
            <p>A configured mismatch displays a warning but does not block submission.</p>
          </div>
          <div className="instructor-submit-actions">
            <InstructorButton type="primary" onClick={handleSubmit}>
              {isResubmit ? "Resubmit Course" : "Submit Course"}
            </InstructorButton>
          </div>
        </SectionCard>
        <SectionCard title="Approval route" className="instructor-submit-side">
          <p>Draft or Rejected → Submitted</p>
          <p>Organizer reviews and decides.</p>
          <p>The Course is not Published until approval.</p>
        </SectionCard>
      </div>
    </InstructorPage>
  );
};

export default CourseSubmit;
