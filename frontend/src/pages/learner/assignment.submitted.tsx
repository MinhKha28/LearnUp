import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { PageHeader, SuccessScreen } from "@/components/learner/learner.ui";
import type { ISubmissionReceipt } from "@/types/assessment.types";

interface ISubmittedState {
  receipt?: ISubmissionReceipt;
  title?: string;
}

const formatTime = (iso: string) => new Date(iso).toLocaleString();

const AssignmentSubmitted = () => {
  const { enrollmentId: courseId, assignmentId } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  const { receipt, title } = (state ?? {}) as ISubmittedState;

  // Opened without having just submitted (a reload, a bookmark): nothing to confirm.
  if (!receipt) {
    return <Navigate to={`/learner/courses/${courseId}/assessments`} replace />;
  }

  const waitingForCycle = receipt.gradingStatus === "AwaitingPeerReview";
  const { attempts } = receipt;

  return (
    <>
      <PageHeader
        eyebrow="ASSESSMENTS / SUBMITTED"
        title="Assignment submitted"
        subtitle={title ? `${title} is now awaiting the grading process.` : "Your work is now awaiting the grading process."}
      />
      <SuccessScreen
        tone="success"
        title="Submission received"
        primary={{
          label: "Back to Assessments",
          onClick: () => navigate(`/learner/courses/${courseId}/assessments`),
        }}
        secondary={{
          label: "View Assignment",
          onClick: () => navigate(`/learner/courses/${courseId}/assignments/${assignmentId}`),
        }}
      >
        <p>Submitted on {formatTime(receipt.submittedAt)}.</p>
        {waitingForCycle && receipt.cycle ? (
          <p>
            It is in the peer review cycle that closes on {formatTime(receipt.cycle.closesAt)}. Reviews are due by{" "}
            {formatTime(receipt.cycle.reviewDueAt)}.
          </p>
        ) : (
          <p>Your Instructor will grade it.</p>
        )}
        {attempts.lockedUntil ? (
          <p>
            You have used all {attempts.maxConsecutiveAttempts} submissions in a row. You can submit again at{" "}
            {formatTime(attempts.lockedUntil)}.
          </p>
        ) : (
          <p>
            Submissions left before a pause: {attempts.remainingAttempts} of {attempts.maxConsecutiveAttempts}.
          </p>
        )}
        <p>Your latest submission will be used for the Assignment result.</p>
      </SuccessScreen>
    </>
  );
};

export default AssignmentSubmitted;
