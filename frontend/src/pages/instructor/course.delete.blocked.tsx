import { useNavigate, useParams } from "react-router-dom";
import { InstructorPage, PageHeader, SuccessScreen } from "@/components/instructor/instructor.ui";

const CourseDeleteBlocked = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();

  return (
    <InstructorPage className="instructor-course-delete-blocked">
      <PageHeader
        eyebrow="INSTRUCTOR"
        title="Course cannot be deleted"
        subtitle="This Course has learning history or is not Draft/Rejected."
      />
      <SuccessScreen
        tone="error"
        title="Deletion unavailable"
        secondary={{
          label: "Back to Course",
          onClick: () => navigate(`/instructor/courses/${courseId}`),
        }}
      >
        <p>A Course with any past Enrollment cannot be deleted.</p>
      </SuccessScreen>
    </InstructorPage>
  );
};

export default CourseDeleteBlocked;
