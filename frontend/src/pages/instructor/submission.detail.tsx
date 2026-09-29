import { useNavigate, useParams } from "react-router-dom";
import { findSubmission } from "@/components/instructor/instructor.data";
import {
  InfoPanel,
  InstructorButton,
  InstructorPage,
  PageHeader,
  SectionCard,
} from "@/components/instructor/instructor.ui";
import "./submissions.scss";

const reviewActionLabel: Record<string, string> = {
  discrepancy: "Review and grade",
  "insufficient-reviews": "Review and grade",
  "ready-to-publish": "Review and grade",
  "awaiting-review": "Awaiting reviewer feedback",
  graded: "Grade published",
};

const SubmissionDetail = () => {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const submission = findSubmission(submissionId);

  if (!submission) {
    return (
      <InstructorPage className="instructor-submissions">
        <PageHeader
          eyebrow="SUBMISSIONS / DETAIL"
          title="Submission not found"
          subtitle="This Submission may have been removed."
          back
        />
        <InstructorButton onClick={() => navigate("/instructor/submissions")}>
          Back to Submissions
        </InstructorButton>
      </InstructorPage>
    );
  }

  const handleReviewAndGrade = () => {
    switch (submission.reviewState) {
      case "discrepancy":
        navigate(`/instructor/submissions/${submission.id}/discrepancy`);
        return;
      case "insufficient-reviews":
        navigate(`/instructor/submissions/${submission.id}/grade`);
        return;
      case "ready-to-publish":
        navigate(`/instructor/submissions/${submission.id}/finalize`);
        return;
      default:
    }
  };

  const actionDisabled = submission.reviewState === "awaiting-review" || submission.reviewState === "graded";

  return (
    <InstructorPage className="instructor-submissions">
      <PageHeader
        eyebrow="SUBMISSIONS / DETAIL"
        title="Submission Details"
        subtitle={`${submission.assignmentTitle} / Learner: ${submission.learnerName}`}
        back
      />
      <div className="instructor-submission-detail-grid">
        <SectionCard title="Learner work">
          <p className="instructor-submission-meta">Submitted [Date & time]</p>
          <div className="instructor-submission-body">
            <p>[Full written submission content]</p>
            <p>[Attached file available for review]</p>
          </div>
          <hr className="instructor-submission-divider" />
          <h2 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 650, color: "#1e293b" }}>
            Submission history
          </h2>
          <p className="instructor-submission-history-note">
            Latest submission determines recorded Assignment score.
          </p>
        </SectionCard>
        <SectionCard title="Peer reviews and grading">
          <div className="instructor-review-table">
            <div className="instructor-review-row instructor-review-head">
              <span>Reviewer</span>
              <span>Score</span>
              <span>Feedback</span>
            </div>
            {submission.reviewers.map((review) => (
              <div className="instructor-review-row" key={review.reviewerName}>
                <strong>{review.reviewerName}</strong>
                <span>{review.scoreLabel}</span>
                <span>{review.feedbackLabel}</span>
              </div>
            ))}
            {submission.reviewers.length === 0 && (
              <div className="instructor-review-row">
                <span>No Peer reviews yet.</span>
                <span />
                <span />
              </div>
            )}
          </div>
          <InfoPanel title="Instructor visibility">
            Author and reviewer identities are visible to the Instructor.
          </InfoPanel>
          <div style={{ marginTop: 20 }}>
            <InstructorButton type="primary" block disabled={actionDisabled} onClick={handleReviewAndGrade}>
              {reviewActionLabel[submission.reviewState]}
            </InstructorButton>
          </div>
        </SectionCard>
      </div>
    </InstructorPage>
  );
};

export default SubmissionDetail;
