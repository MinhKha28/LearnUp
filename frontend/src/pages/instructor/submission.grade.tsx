import { useEffect, useMemo, useState } from "react";
import { Alert, Input, InputNumber, Spin, message } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import {
  InfoPanel,
  InstructorButton,
  InstructorPage,
  PageHeader,
  SectionCard,
  StatusTag,
  WarningPanel,
} from "@/components/instructor/instructor.ui";
import FileLink from "@/components/instructor/submission.file.link";
import {
  getSubmissionDetailAPI,
  gradeSubmissionAPI,
} from "@/services/instructor.submission.service";
import type {
  IInstructorReviewResult,
  ISubmissionDetail,
} from "@/types/submission.types";
import {
  formatDateTime,
  gradingStatusView,
  interventionLabel,
  personName,
} from "@/utils/submission.labels";
import "./submissions.scss";

const COMMENT_MAX_LENGTH = 2000;

const roundScore = (value: number) => Math.round(value * 100) / 100;

const reasonGuide = (reason: string | null, peerScores: number[]) => {
  if (reason === "SCORE_GAP_EXCEEDED" && peerScores.length > 1) {
    const gap = roundScore(Math.max(...peerScores) - Math.min(...peerScores));
    return `Peer scores ${peerScores.join(", ")} differ by ${gap} points. Your grade is averaged with them to suggest the final score.`;
  }
  if (reason === "REVIEWER_MISSED_DEADLINE" || reason === "REVIEWER_DEACTIVATED") {
    return "Your grade fills in for the missing peer review and is averaged with the completed ones.";
  }
  if (peerScores.length > 0) {
    return "Your grade is averaged with the completed peer reviews to suggest the final score.";
  }
  return "No completed peer review exists, so your grade becomes the suggested final score.";
};

const SubmissionGrade = () => {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ISubmissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [points, setPoints] = useState<Record<string, number | null>>({});
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  const rubric = useMemo(() => detail?.assignment.rubric ?? [], [detail]);
  const peerScores = useMemo(
    () =>
      (detail?.reviews ?? [])
        .filter((review) => review.status === "Completed" && review.score !== null)
        .map((review) => review.score as number),
    [detail],
  );

  const possible = rubric.reduce((sum, criterion) => sum + criterion.maxPoints, 0);
  const earned = rubric.reduce((sum, criterion) => sum + (points[criterion.id] ?? 0), 0);
  const complete =
    rubric.length > 0 &&
    rubric.every((criterion) => typeof points[criterion.id] === "number");
  const hasComment = comment.trim().length > 0;
  const score = possible > 0 ? roundScore((earned / possible) * 100) : 0;
  const suggested = roundScore(
    [...peerScores, score].reduce((sum, value) => sum + value, 0) /
      (peerScores.length + 1),
  );

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
          eyebrow="SUBMISSIONS / GRADE"
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
  const gradable =
    detail.isLatest && detail.gradingStatus === "AwaitingInstructor";
  const backToDetail = () => navigate(`/instructor/submissions/${detail.id}`);

  const handleSubmit = async () => {
    if (!complete) {
      message.warning("Give a score for every Rubric criterion.");
      return;
    }
    if (!hasComment) {
      message.warning("Write a general comment for the Learner.");
      return;
    }
    setSubmitting(true);
    try {
      const res = (await gradeSubmissionAPI(detail.id, {
        scores: rubric.map((criterion) => ({
          criterionId: criterion.id,
          points: points[criterion.id] as number,
        })),
        comment: comment.trim(),
      })) as unknown as IBackendRes<IInstructorReviewResult>;
      if (res.data) {
        message.success(
          `Submission graded. Suggested final score: ${res.data.suggestedScore} / 100.`,
        );
        backToDetail();
      } else {
        message.error(
          typeof res.message === "string"
            ? res.message
            : "Could not save the grade.",
        );
      }
    } catch {
      message.error("Could not connect to the server.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <InstructorPage className="instructor-submissions">
      <PageHeader
        eyebrow="SUBMISSIONS / GRADE"
        title={`Grade ${personName(detail.learner)}`}
        subtitle={`${detail.assignment.title} / Attempt #${detail.submissionNumber}`}
        back
      />

      {!gradable && (
        <Alert
          type="info"
          showIcon
          message={
            detail.isLatest
              ? `This submission is "${status.label}" and is not waiting for your grading.`
              : "This submission was replaced by a newer one. Only the latest submission can be graded."
          }
          action={<InstructorButton onClick={backToDetail}>View submission</InstructorButton>}
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
            </p>
            <div className="instructor-submission-body">
              {detail.content ? (
                <p>{detail.content}</p>
              ) : (
                <p className="instructor-submission-empty-text">No written answer.</p>
              )}
            </div>
            {detail.file && <FileLink file={detail.file} />}
          </SectionCard>

          <SectionCard title="Why you are grading">
            <WarningPanel title={reason ?? "Instructor grading"}>
              {reasonGuide(detail.interventionReason, peerScores)}
            </WarningPanel>
            {peerScores.length > 0 && (
              <div className="instructor-grade-peers">
                {detail.reviews
                  .filter((review) => review.status === "Completed")
                  .map((review) => (
                    <div key={review.id}>
                      <span>{personName(review.reviewer)}</span>
                      <b>{review.score ?? "-"} / 100</b>
                    </div>
                  ))}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="instructor-submission-column">
          <SectionCard title="Grade with Rubric">
            {rubric.length === 0 ? (
              <p className="instructor-submission-empty-text">
                This Assignment has no Rubric criteria to grade against.
              </p>
            ) : (
              <div className="instructor-submission-grade-form">
                {rubric.map((criterion) => (
                  <div className="instructor-grade-field" key={criterion.id}>
                    <label>
                      {criterion.name}
                      <small> / {criterion.maxPoints} pts</small>
                    </label>
                    {criterion.description && (
                      <p className="instructor-grade-reason">{criterion.description}</p>
                    )}
                    <InputNumber
                      style={{ width: "100%" }}
                      placeholder={`0 - ${criterion.maxPoints}`}
                      min={0}
                      max={criterion.maxPoints}
                      precision={0}
                      disabled={!gradable}
                      value={points[criterion.id] ?? undefined}
                      onChange={(value) =>
                        setPoints((prev) => ({
                          ...prev,
                          [criterion.id]: typeof value === "number" ? value : null,
                        }))
                      }
                    />
                  </div>
                ))}

                <div className="instructor-grade-field">
                  <label>
                    Feedback for the Learner
                    <small> / required</small>
                  </label>
                  <Input.TextArea
                    rows={4}
                    placeholder="Explain the strengths and what to improve."
                    status={gradable && complete && !hasComment ? "warning" : undefined}
                    maxLength={COMMENT_MAX_LENGTH}
                    showCount
                    disabled={!gradable}
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                  />
                </div>

                <div className="instructor-grade-summary">
                  <div>
                    <span>Rubric total</span>
                    <strong>
                      {earned} / {possible} pts
                    </strong>
                  </div>
                  <div>
                    <span>Your score</span>
                    <strong>{complete ? score : "-"} / 100</strong>
                  </div>
                  <div>
                    <span>Suggested final score</span>
                    <strong>{complete ? suggested : "-"} / 100</strong>
                  </div>
                </div>

                <InfoPanel title="After grading">
                  The submission moves to "Ready to finalize". The final score is
                  only recorded when you finalize it.
                </InfoPanel>

                <div className="instructor-grade-actions">
                  <InstructorButton onClick={backToDetail}>Cancel</InstructorButton>
                  <InstructorButton
                    type="primary"
                    loading={submitting}
                    disabled={!gradable || !complete || !hasComment}
                    onClick={handleSubmit}
                  >
                    Submit grade
                  </InstructorButton>
                </div>
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </InstructorPage>
  );
};

export default SubmissionGrade;
