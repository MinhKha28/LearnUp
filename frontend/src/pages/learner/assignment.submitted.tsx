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

  const { attempts, cycle } = receipt;
  const resubmitted = receipt.replacedSubmissionId !== null;

  return (
    <>
      <PageHeader
        eyebrow="ASSESSMENTS / SUBMITTED"
        title={resubmitted ? "Assignment resubmitted" : "Assignment submitted"}
        subtitle={title ? `${title} is now awaiting the grading process.` : "Your work is now awaiting the grading process."}
      />
      <SuccessScreen
        tone="success"
        title={resubmitted ? "Resubmission received" : "Submission received"}
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
        {cycle ? (
          <p>
            {receipt.placement === "REPLACES_IN_CYCLE"
              ? "It replaces your previous submission in the peer review cycle that closes on "
              : "It is in the peer review cycle that closes on "}
            {formatTime(cycle.closesAt)}. Reviews are due by {formatTime(cycle.reviewDueAt)}.
          </p>
        ) : (
          <p>
            {resubmitted
              ? "The peer review cycle of your previous submission is closed, or peer review is off, so your Instructor will grade it directly."
              : "Your Instructor will grade it."}
          </p>
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
