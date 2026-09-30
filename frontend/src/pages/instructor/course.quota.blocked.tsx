import { useNavigate } from "react-router-dom";
import { InstructorPage, PageHeader, SuccessScreen } from "@/components/instructor/instructor.ui";

const CourseQuotaBlocked = () => {
  const navigate = useNavigate();

  return (
    <InstructorPage className="instructor-course-quota-blocked">
      <PageHeader
        eyebrow="MY COURSES / CREATE"
        title="Course Limit Reached"
        subtitle="Your Organization has reached the Course limit of its Subscription."
      />
      <SuccessScreen
        tone="warning"
        title="Cannot create another Course"
        secondary={{
          label: "Back to My Courses",
          onClick: () => navigate("/instructor/courses"),
        }}
      >
        <p>Contact the Organizer about the Subscription Course limit.</p>
      </SuccessScreen>
    </InstructorPage>
  );
};

export default CourseQuotaBlocked;
