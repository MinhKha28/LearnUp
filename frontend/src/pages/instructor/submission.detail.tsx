import { useEffect, useState } from "react";
import { Alert, Spin } from "antd";
import { EditOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import {
  InfoPanel,
  InstructorButton,
  InstructorPage,
  PageHeader,
  SectionCard,
  StatusTag,
} from "@/components/instructor/instructor.ui";
import FileLink from "@/components/instructor/submission.file.link";
import { getSubmissionDetailAPI } from "@/services/instructor.submission.service";
import type { ISubmissionDetail } from "@/types/submission.types";
import {
  formatDateTime,
  gradingStatusView,
  interventionLabel,
  personName,
} from "@/utils/submission.labels";
import "./submissions.scss";

const SubmissionDetail = () => {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ISubmissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!submissionId) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getSubmissionDetailAPI(submissionId);
        if (!active) return;
        if (res.data) setDetail(res.data);
        else setError("This submission was not found or is not yours to review.");
      } catch {
        if (active) setError("Could not connect to the server.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [submissionId]);

  if (loading) {
    return (
      <InstructorPage className="instructor-submissions">
        <Spin />
      </InstructorPage>
    );
  }

  if (error || !detail) {
    return (
      <InstructorPage className="instructor-submissions">
        <PageHeader
          eyebrow="SUBMISSIONS / DETAIL"
          title="Submission not found"
          subtitle={error ?? "This submission may have been removed."}
          back
        />
        <InstructorButton onClick={() => navigate("/instructor/courses")}>
          Back to My Courses
        </InstructorButton>
      </InstructorPage>
    );
  }

  const status = gradingStatusView(detail.gradingStatus);
  const reason = interventionLabel(detail.interventionReason);
  const rubricMax = detail.assignment.rubric.reduce(
    (sum, criterion) => sum + criterion.maxPoints,
    0,
  );
  const canGrade =
    detail.isLatest && detail.gradingStatus === "AwaitingInstructor";

  return (
    <InstructorPage className="instructor-submissions">
      <PageHeader
        eyebrow="SUBMISSIONS / DETAIL"
        title={personName(detail.learner)}
        subtitle={`${detail.assignment.title} / Attempt #${detail.submissionNumber}`}
        back
        actions={
          canGrade && (
            <InstructorButton
              type="primary"
              icon={<EditOutlined />}
              onClick={() =>
                navigate(`/instructor/submissions/${detail.id}/grade`)
              }
            >
              Grade submission
            </InstructorButton>
          )
        }
      />
      {!detail.isLatest && (
        <Alert
          type="info"
          showIcon
          message="This submission was replaced by a newer one. Only the latest submission counts toward the score."
        />
      )}

      <div className="instructor-submission-detail-grid">
        <div className="instructor-submission-column">
          <SectionCard title="Learner work">
            <div className="instructor-submission-status">
              <StatusTag tone={status.tone}>{status.label}</StatusTag>
              {reason && <span>{reason}</span>}
            </div>
            <p className="instructor-submission-meta">
              Submitted {formatDateTime(detail.submittedAt)}
              {detail.learner.email ? ` / ${detail.learner.email}` : ""}
            </p>
            <div className="instructor-submission-body">
              {detail.content ? (
                <p>{detail.content}</p>
              ) : (
                <p className="instructor-submission-empty-text">
                  No written answer.
                </p>
              )}
            </div>
            {detail.file && <FileLink file={detail.file} />}
            {detail.finalScore !== null && (
              <div className="instructor-submission-final">
                <span>Final score</span>
                <strong>{detail.finalScore}</strong>
                {detail.finalizationComment && (
                  <p>{detail.finalizationComment}</p>
                )}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Reviews">
            {detail.reviews.length === 0 ? (
              <p className="instructor-submission-empty-text">
                No reviews yet.
              </p>
            ) : (
              detail.reviews.map((review) => (
                <div className="instructor-submission-review" key={review.id}>
                  <div className="instructor-submission-review-head">
                    <strong>{personName(review.reviewer)}</strong>
                    <span>{review.reviewerRole}</span>
                    <StatusTag
                      tone={review.status === "Completed" ? "success" : "neutral"}
                    >
                      {review.status}
                    </StatusTag>
                    <b>{review.score ?? "-"}</b>
                  </div>
                  {review.scores.length > 0 && (
                    <ul>
                      {detail.assignment.rubric.map((criterion) => {
                        const score = review.scores.find(
                          (item) => item.criterionId === criterion.id,
                        );
                        return (
                          <li key={criterion.id}>
                            <span>{criterion.name}</span>
                            <span>
                              {score?.points ?? "-"} / {criterion.maxPoints}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {review.comment && <p>{review.comment}</p>}
                </div>
              ))
            )}
            <InfoPanel title="Instructor visibility">
              Learner and reviewer identities are visible to the Instructor.
            </InfoPanel>
          </SectionCard>
        </div>

        <div className="instructor-submission-column">
          <SectionCard title="Assignment">
            <p className="instructor-submission-prompt">
              {detail.assignment.prompt ?? "No written prompt."}
            </p>
            {detail.assignment.promptFile && (
              <FileLink file={detail.assignment.promptFile} />
            )}
            <p className="instructor-submission-meta">
              Passing score: {detail.assignment.passingScore} / 100
            </p>
            <div className="instructor-submission-rubric">
              {detail.assignment.rubric.map((criterion) => (
                <div key={criterion.id}>
                  <span>
                    <strong>{criterion.name}</strong>
                    <small>{criterion.description}</small>
                  </span>
                  <b>{criterion.maxPoints} pts</b>
                </div>
              ))}
              <div className="instructor-submission-rubric-total">
                <span>Total</span>
                <b>{rubricMax} pts</b>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Submission history">
            <p className="instructor-submission-history-note">
              The latest submission determines the recorded score.
            </p>
            {detail.history.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`instructor-submission-history${item.id === detail.id ? " is-current" : ""}`}
                onClick={() => navigate(`/instructor/submissions/${item.id}`)}
              >
                <strong>#{item.submissionNumber}</strong>
                <span>{formatDateTime(item.submittedAt)}</span>
                <StatusTag tone={gradingStatusView(item.gradingStatus).tone}>
                  {gradingStatusView(item.gradingStatus).label}
                </StatusTag>
              </button>
            ))}
          </SectionCard>
        </div>
      </div>
    </InstructorPage>
  );
};

export default SubmissionDetail;
