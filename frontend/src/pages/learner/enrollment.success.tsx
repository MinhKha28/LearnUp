import { useNavigate, useParams } from "react-router-dom";
import { catalogCourseDetails } from "@/components/learner/learner.data";
import { LearnerPage, PageHeader, SuccessScreen } from "@/components/learner/learner.ui";

const EnrollmentSuccess = ({ restored = false }: { restored?: boolean }) => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const course = courseId ? catalogCourseDetails[courseId] : undefined;
  const title = course?.title ?? "This Course";

  return (
    <LearnerPage className="enrollment-success">
      <PageHeader
        eyebrow="LEARNER"
        title={restored ? "Enrollment restored" : "Enrollment confirmed"}
        subtitle={
          restored
            ? "Your previous Optional Course progress has been recovered."
            : `${title} is now in My Courses.`
        }
      />
      {restored ? (
        <SuccessScreen
          tone="success"
          title={`Welcome back to ${title}`}
          primary={{
            label: "Continue learning",
            onClick: () => navigate(`/learner/courses/${courseId}`),
          }}
        >
          <p>Assessment records and learning progress were preserved.</p>
        </SuccessScreen>
      ) : (
        <SuccessScreen
          tone="success"
          title="You are enrolled"
          primary={{
            label: "Start learning",
            onClick: () => navigate(`/learner/courses/${courseId}`),
          }}
          secondary={{ label: "Back to Catalog", onClick: () => navigate("/learner/catalog") }}
        >
          <p>This Optional Course has no completion deadline.</p>
        </SuccessScreen>
      )}
    </LearnerPage>
  );
};

export default EnrollmentSuccess;
