import { useNavigate, useParams } from "react-router-dom";
import { findSubmission } from "@/components/instructor/instructor.data";
import {
  InstructorButton,
  InstructorPage,
  PageHeader,
  SectionCard,
  WarningPanel,
} from "@/components/instructor/instructor.ui";
import "./submissions.scss";

const SubmissionDiscrepancy = () => {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const submission = findSubmission(submissionId);

  if (!submission) {
    return (
      <InstructorPage className="instructor-submissions">
        <PageHeader
          eyebrow="SUBMISSIONS / INTERVENTION"
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

  const [reviewerA, reviewerB] = submission.reviewers;

  return (
    <InstructorPage className="instructor-submissions">
      <PageHeader
        eyebrow="SUBMISSIONS / INTERVENTION"
        title="Review Score Discrepancy"
        subtitle="Peer reviewers gave scores beyond the configured threshold."
        back
      />
      <WarningPanel title="Instructor review required">
        Compare reviewers&apos; criterion scores and decide a final result.
      </WarningPanel>
      <SectionCard className="instructor-discrepancy-card">
        <div className="instructor-discrepancy-table">
          <div className="instructor-discrepancy-row instructor-discrepancy-head">
            <span>Rubric criterion</span>
            <span>Reviewer: {reviewerA?.reviewerName ?? "[Name]"}</span>
            <span>Reviewer: {reviewerB?.reviewerName ?? "[Name]"}</span>
            <span>Difference</span>
          </div>
          {submission.criteriaComparison.map((row) => (
            <div className="instructor-discrepancy-row" key={row.criterionLabel}>
              <strong>{row.criterionLabel}</strong>
              <span>{row.reviewerAScoreLabel}</span>
              <span>{row.reviewerBScoreLabel}</span>
              <span>{row.differenceLabel}</span>
            </div>
          ))}
          {submission.criteriaComparison.length === 0 && (
            <div className="instructor-discrepancy-row">
              <span>No criterion comparison recorded.</span>
              <span />
              <span />
              <span />
            </div>
          )}
        </div>
        <div className="instructor-grade-actions">
          <InstructorButton
            type="primary"
            onClick={() => navigate(`/instructor/submissions/${submission.id}/finalize`)}
          >
            Grade or adjust final score
          </InstructorButton>
        </div>
      </SectionCard>
    </InstructorPage>
  );
};

export default SubmissionDiscrepancy;
