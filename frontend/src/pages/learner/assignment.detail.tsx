import { useState } from "react";
import { Modal } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import {
  assignmentStatusLabel,
  courseDetails,
  findAssignment,
} from "@/components/learner/learner.data";
import {
  DetailItem,
  InfoPanel,
  LearnerButton,
  PageHeader,
  StatCard,
  StatusTag,
  WarningPanel,
} from "@/components/learner/learner.ui";
import "./assignment.detail.scss";

const AssignmentDetail = () => {
  const { enrollmentId: courseId, assignmentId } = useParams();
  const navigate = useNavigate();
  const course = courseId ? courseDetails[courseId] : undefined;
  const assignment = course ? findAssignment(course, assignmentId) : undefined;
  const [resultModalOpen, setResultModalOpen] = useState(false);

  if (!course || !assignment) {
    return null;
  }

  const audienceLabel = course.audience === "required" ? "Required" : "Optional";

  if (assignment.status === "locked") {
    return (
      <>
        <PageHeader
          eyebrow="ASSESSMENTS / ASSIGNMENT"
          title={assignment.title}
          subtitle="This Assignment is temporarily locked for your account."
        />
        <div className="course-learning-content">
          <WarningPanel title="Temporary lock">
            You reached the consecutive submission limit without meeting the pass score.
          </WarningPanel>
          <div className="assignment-locked-card">
            <span>You can submit again at</span>
            <strong>{assignment.lockedUntil}</strong>
            <p>The consecutive submission counter resets when this lock ends.</p>
            {assignment.grading && (
              <LearnerButton onClick={() => setResultModalOpen(true)}>View latest result</LearnerButton>
            )}
          </div>
        </div>
        <Modal
          open={resultModalOpen}
          onCancel={() => setResultModalOpen(false)}
          footer={null}
          title="Latest result"
        >
          {assignment.grading ? (
            <p>
              Final score: <strong>{assignment.grading.finalScore}%</strong> (minimum{" "}
              {assignment.grading.passThreshold}%)
            </p>
          ) : (
            <p>No prior graded result is available yet.</p>
          )}
        </Modal>
      </>
    );
  }

  if (assignment.status === "graded" && assignment.grading) {
    const grading = assignment.grading;
    return (
      <>
        <PageHeader
          eyebrow="ASSESSMENTS / RESULT"
          title="Assignment Result"
          subtitle={`${assignment.title} / Latest submission`}
        />
        <div className="course-learning-content">
          <div className="assignment-result-card">
            <StatusTag tone="success">{grading.published ? "Published" : "Pending"}</StatusTag>
            <div className="assignment-result-stats">
              <StatCard label="Final score" value={`${grading.finalScore}%`} />
              <StatCard label="Minimum score" value={`${grading.passThreshold}%`} />
            </div>
          </div>
          <div className="assignment-rubric-card">
            <h3>Rubric and feedback</h3>
            <table className="assignment-rubric-table">
              <thead>
                <tr>
                  <th>Criterion</th>
                  <th>Score</th>
                  <th>Feedback</th>
                </tr>
              </thead>
              <tbody>
                {grading.criteria.map((criterion) => (
                  <tr key={criterion.name}>
                    <td>
                      <strong>{criterion.name}</strong>
                    </td>
                    <td>
                      {criterion.score}/{criterion.maxScore}
                    </td>
                    <td>{criterion.feedback}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <InfoPanel title="Reviewer privacy">
              Peer reviewers are anonymous to the submission author.
            </InfoPanel>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="ASSESSMENTS / ASSIGNMENT"
        title={assignment.title}
        subtitle={`${course.title} / ${audienceLabel} Assignment`}
      />
      <div className="course-learning-main">
          <div className="course-learning-content assignment-instructions-card">
            <StatusTag tone={course.audience === "required" ? "warning" : "info"}>
              {audienceLabel}
            </StatusTag>
            <h3>Instructions</h3>
            {assignment.instructions.map((line) => (
              <p key={line}>{line}</p>
            ))}
            <hr />
            <h3>Assessment criteria</h3>
            <p>Rubric: {assignment.rubric}</p>
            <p>Minimum score: {assignment.minScore}%</p>
            <p>Estimated effort: {assignment.estimatedEffort}</p>
            <InfoPanel title="Submission policy">
              No separate Assignment deadline. The latest submission is recorded.
            </InfoPanel>
            <div className="assignment-instructions-actions">
              {assignment.status === "not-submitted" && (
                <LearnerButton
                  type="primary"
                  onClick={() => navigate(`/learner/courses/${course.id}/assignments/${assignment.id}/submit`)}
                >
                  Submit Assignment
                </LearnerButton>
              )}
              {assignment.status === "returned" && (
                <LearnerButton
                  type="primary"
                  onClick={() => navigate(`/learner/courses/${course.id}/assignments/${assignment.id}/resubmit`)}
                >
                  Resubmit Assignment
                </LearnerButton>
              )}
            </div>
          </div>
          <div className="course-learning-side">
            <div className="assignment-status-panel">
              <h3>Your status</h3>
              <StatusTag
                tone={
                  assignment.status === "returned"
                    ? "error"
                    : assignment.status === "submitted"
                      ? "warning"
                      : "neutral"
                }
              >
                {assignmentStatusLabel(assignment.status)}
              </StatusTag>
              <DetailItem label="Attempts left in current consecutive sequence">
                {assignment.attemptsRemaining}
              </DetailItem>
              {assignment.submission && (
                <DetailItem label="Last submitted">{assignment.submission.submittedAt}</DetailItem>
              )}
            </div>
          </div>
        </div>
    </>
  );
};

export default AssignmentDetail;
