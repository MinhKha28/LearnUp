import { useNavigate, useParams } from "react-router-dom";
import { courseDetails, findAssignment } from "@/components/learner/learner.data";
import { PageHeader, SuccessScreen } from "@/components/learner/learner.ui";

const AssignmentSubmitted = () => {
  const { courseId, assignmentId } = useParams();
  const navigate = useNavigate();
  const course = courseId ? courseDetails[courseId] : undefined;
  const assignment = course ? findAssignment(course, assignmentId) : undefined;

  if (!course || !assignment) {
    return null;
  }

  return (
    <>
      <PageHeader
        eyebrow="ASSESSMENTS / SUBMITTED"
        title="Assignment submitted"
        subtitle="Your work is now awaiting the grading process."
      />
      <SuccessScreen
        tone="success"
        title="Submission received"
        primary={{
          label: "View submission",
          onClick: () => navigate(`/learner/courses/${course.id}/assignments/${assignment.id}`),
        }}
      >
        <p>Status: Awaiting review or Instructor grading</p>
        <p>Your latest submission will be used for the Assignment result.</p>
      </SuccessScreen>
    </>
  );
};

export default AssignmentSubmitted;
