import { useNavigate, useParams } from "react-router-dom";
import { findInstructorCourse } from "@/components/instructor/instructor.data";
import {
  InstructorButton,
  InstructorPage,
  PageHeader,
  SuccessScreen,
} from "@/components/instructor/instructor.ui";
import "./course.create.scss";

const CourseSubmitted = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const course = findInstructorCourse(courseId);

  if (!course) {
    return (
      <InstructorPage className="instructor-course-create">
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

  return (
    <InstructorPage className="instructor-course-create">
      <PageHeader
        eyebrow="COURSE / APPROVAL"
        title="Course Submitted"
        subtitle="The Organizer has been notified and can review this Course."
      />
      <SuccessScreen
        tone="success"
        title="Awaiting Organizer review"
        secondary={{
          label: "View submitted Course",
          onClick: () => navigate(`/instructor/courses/${course.id}`),
        }}
      >
        <p>Status: Submitted • The Course is not yet available to Learners.</p>
      </SuccessScreen>
    </InstructorPage>
  );
};

export default CourseSubmitted;
