import { useState } from "react";
import { Input, Select, message } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { findPeerReviewTask } from "@/components/learner/learner.data";
import {
  LearnerButton,
  LearnerPage,
  PageHeader,
  StatusTag,
} from "@/components/learner/learner.ui";
import "./peer.review.form.scss";

const scoreOptions = [0, 1, 2, 3, 4, 5].map((value) => ({
  value,
  label: `${value} / 5`,
}));

const PeerReviewForm = () => {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const task = findPeerReviewTask(submissionId);
  const isReadOnly = task?.status === "completed";

  const [scores, setScores] = useState<Record<number, number | undefined>>(
    () =>
      Object.fromEntries(
        (task?.criteria ?? []).map((_, index) => [index, task?.result?.scores[index]]),
      ),
  );
  const [feedback, setFeedback] = useState(task?.result?.feedback ?? "");

  if (!task) {
    return (
      <LearnerPage className="peer-review-form">
        <PageHeader eyebrow="PEER REVIEW / ASSIGNED WORK" title="Submission not found" subtitle="" back />
        <LearnerButton onClick={() => navigate("/learner/peer-review")}>
          Back to Peer Review
        </LearnerButton>
      </LearnerPage>
    );
  }

  const submit = () => {
    const missing = task.criteria.some((_, index) => scores[index] === undefined);
    if (missing) {
      message.warning("Select a score for every criterion before submitting.");
      return;
    }
    message.success("Review submitted.");
    navigate("/learner/peer-review");
  };

  return (
    <LearnerPage className="peer-review-form">
      <PageHeader
        eyebrow="PEER REVIEW / ASSIGNED WORK"
        title={`Review Submission ${task.id}`}
        subtitle={`${task.assignmentTitle} / Deadline ${task.reviewDeadline}`}
        back
      />
      <div className="peer-review-form-body">
        <div className="peer-review-submission-card">
          <h3>Anonymous submission</h3>
          <StatusTag tone="neutral">Author hidden</StatusTag>
          <span className="peer-review-submission-label">Submitted response</span>
          <p>{task.submittedResponse}</p>
          {task.attachmentName && (
            <>
              <hr />
              <span className="peer-review-submission-label">Attached work</span>
              <div className="peer-review-attachment">
                <a
                  href={`data:text/plain,${encodeURIComponent(
                    `Attachment placeholder for ${task.attachmentName}`,
                  )}`}
                  download={task.attachmentName}
                >
                  View submitted attachment
                </a>
              </div>
            </>
          )}
        </div>
        <div className="peer-review-score-card">
          <h3>Score using the Rubric</h3>
          {task.criteria.map((criterion, index) => (
            <div className="peer-review-criterion" key={criterion}>
              <span>{criterion}</span>
              <Select
                placeholder="Select score"
                options={scoreOptions}
                value={scores[index]}
                disabled={isReadOnly}
                onChange={(value) => setScores((prev) => ({ ...prev, [index]: value }))}
              />
            </div>
          ))}
          <div className="peer-review-feedback">
            <span>Feedback</span>
            <Input.TextArea
              rows={4}
              placeholder="Write specific feedback..."
              value={feedback}
              disabled={isReadOnly}
              onChange={(event) => setFeedback(event.target.value)}
            />
          </div>
          {isReadOnly ? (
            <p className="peer-review-completed-note">
              Reviewed on {task.result?.completedAt}. This review can no longer be edited.
            </p>
          ) : (
            <div className="peer-review-form-actions">
              <LearnerButton type="primary" onClick={submit}>
                Submit review
              </LearnerButton>
            </div>
          )}
        </div>
      </div>
    </LearnerPage>
  );
};

export default PeerReviewForm;
