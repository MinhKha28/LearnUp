import { message } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import {
  courseStatusLabel,
  findInstructorCourse,
  withdrawCourseSubmission,
} from "@/components/instructor/instructor.data";
import {
  InstructorButton,
  InstructorPage,
  PageHeader,
  WarningPanel,
} from "@/components/instructor/instructor.ui";
import "./course.withdraw.scss";

const CourseWithdraw = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const course = findInstructorCourse(courseId);

  if (!course) {
    return (
      <InstructorPage className="instructor-course-withdraw">
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

  if (course.status !== "submitted") {
    return (
      <InstructorPage className="instructor-course-withdraw">
        <PageHeader
          eyebrow="COURSE / APPROVAL"
          title="Nothing to withdraw"
          subtitle={`This Course is currently ${courseStatusLabel[course.status]}.`}
          back
        />
        <InstructorButton onClick={() => navigate(`/instructor/courses/${course.id}`)}>
          Back to Course
        </InstructorButton>
      </InstructorPage>
    );
  }

  const handleWithdraw = () => {
    withdrawCourseSubmission(course);
    message.success("Course withdrawn to Draft.");
    navigate(`/instructor/courses/${course.id}`);
  };

  return (
    <InstructorPage className="instructor-course-withdraw">
      <PageHeader
        eyebrow="COURSE / APPROVAL"
        title="Withdraw Submitted Course"
        subtitle="The Organizer has not decided on this Course yet."
        back
      />
      <WarningPanel title="Submitted state">
        You can return the Course to Draft before an Organizer decision.
      </WarningPanel>
      <div className="instructor-withdraw-card">
        <h2>{course.title}</h2>
        <p>Current status: {courseStatusLabel[course.status]}</p>
        <p>Withdrawal restores Draft editing access.</p>
        <div className="instructor-withdraw-actions">
          <InstructorButton onClick={() => navigate(-1)}>Cancel</InstructorButton>
          <InstructorButton type="primary" onClick={handleWithdraw}>
            Withdraw to Draft
          </InstructorButton>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseWithdraw;
