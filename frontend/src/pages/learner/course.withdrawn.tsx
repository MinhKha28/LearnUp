import { useNavigate, useParams } from "react-router-dom";
import { courseDetails } from "@/components/learner/learner.data";
import { LearnerPage, PageHeader, SuccessScreen } from "@/components/learner/learner.ui";

const CourseWithdrawn = () => {
  const { enrollmentId: courseId } = useParams();
  const navigate = useNavigate();
  const course = courseId ? courseDetails[courseId] : undefined;
  const title = course?.title ?? "This Course";

  return (
    <LearnerPage className="course-withdrawn">
      <PageHeader
        eyebrow="LEARNER"
        title="Course withdrawn"
        subtitle={`${title} has been removed from your active Courses.`}
      />
      <SuccessScreen
        tone="neutral"
        title="Withdrawal confirmed"
        primary={{ label: "Back to My Courses", onClick: () => navigate("/learner/courses") }}
      >
        <p>Your record follows the result retention rule shown at confirmation.</p>
      </SuccessScreen>
    </LearnerPage>
  );
};

export default CourseWithdrawn;
