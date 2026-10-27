import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DetailItem, InfoPanel, LearnerButton, PageHeader, StatusTag } from "@/components/learner/learner.ui";
import { assessmentErrorText, fetchLearnerResultAPI } from "@/services/assessment.service";
import type { IGradingResult } from "@/types/assessment.types";
import "./assignment.result.scss";

const formatTime = (iso: string) => new Date(iso).toLocaleString();

/** UC30.2 - the final score, the score per criterion and the comments of a Finalized submission (BR-208, BR-322). */
const AssignmentResult = () => {
  const { enrollmentId: courseId, assignmentId } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState<IGradingResult | null>(null);
  const [loading, setLoading] = useState(true);
  // set when there is nothing to show: not submitted, not graded yet (PRE-1), or the call failed
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!assignmentId) return;
    let active = true;
    const load = async () => {
      try {
        // PRE-1: only a Finalized submission has a result; the server says so when it has none.
        const res = await fetchLearnerResultAPI(assignmentId);
        if (!active) return;
        if (res.data) setResult(res.data);
        else setNotice(assessmentErrorText(res, "Unable to load the result."));
      } catch {
        if (active) setNotice("Unable to reach the Assessment service. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [assignmentId]);

  const back = () => navigate(`/learner/courses/${courseId}/assessments`);

  if (!result) {
    return (
      <>
        <PageHeader
          eyebrow="ASSESSMENTS / RESULT"
          title={loading ? "Loading result..." : "Result unavailable"}
          subtitle={loading ? "Please wait." : notice}
          back
        />
        {!loading && <LearnerButton onClick={back}>Back to Assessments</LearnerButton>}
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="ASSESSMENTS / RESULT"
        title={`${result.assignment.title} - result`}
        subtitle={`Submission ${result.submission.submissionNumber}, sent on ${formatTime(result.submission.submittedAt)}.`}
        back
      />
      <div className="course-learning-main">
        <div className="course-learning-content assignment-result-card">
          <div className="assignment-result-score">
            <span>Final score</span>
            <strong>{result.finalScore}%</strong>
            <StatusTag tone={result.passed ? "success" : "error"}>{result.passed ? "Passed" : "Not passed"}</StatusTag>
          </div>
          {result.finalizationComment && (
            <InfoPanel title="Note from your Instructor">{result.finalizationComment}</InfoPanel>
          )}

          <h3>Score by criterion</h3>
          <ul className="assignment-result-criteria">
            {result.criteria.map((criterion) => (
              <li key={criterion.id}>
                <span>{criterion.name}</span>
                <em>
                  {criterion.averagePoints === null ? "-" : criterion.averagePoints} / {criterion.maxPoints} pts
                </em>
              </li>
            ))}
          </ul>

          <h3>Comments</h3>
          {result.comments.length === 0 ? (
            <p className="assignment-result-empty">There are no comments.</p>
          ) : (
            <ul className="assignment-result-comments">
              {result.comments.map((item, index) => (
                <li key={index}>
                  <strong>{item.source === "INSTRUCTOR" ? "Instructor" : "Peer reviewer"}</strong>
                  <p>{item.comment}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="assignment-result-actions">
            <LearnerButton type="primary" onClick={back}>
              Back to Assessments
            </LearnerButton>
          </div>
        </div>
        <div className="course-learning-side">
          <div className="assignment-result-info">
            <h3>Result information</h3>
            <DetailItem label="Minimum score">{result.assignment.passingScore}%</DetailItem>
            <DetailItem label="Graded on">{formatTime(result.finalizedAt)}</DetailItem>
            <DetailItem label="Reviewers">Hidden</DetailItem>
          </div>
        </div>
      </div>
    </>
  );
};

export default AssignmentResult;
