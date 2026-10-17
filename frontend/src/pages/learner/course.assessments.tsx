import { useEffect, useState } from "react";
import { Tooltip } from "antd";
import { LockOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { LearnerSkeleton } from "@/components/learner/learner.states";
import { InfoPanel, LearnerButton, PageHeader, StatusTag } from "@/components/learner/learner.ui";
import { LearningError } from "@/components/learner/learning.error";
import { useApiQuery } from "@/hooks/use.api.query";
import { assessmentErrorText, fetchLearnerAssessmentsAPI } from "@/services/assessment.service";
import { fetchCurriculum } from "@/services/learning.service";
import type { ILearnerAssessmentItem, ILearnerAssessmentList } from "@/types/assessment.types";
import "./course.assessments.scss";

const formatTime = (iso: string) => new Date(iso).toLocaleString();

const statusView = (item: ILearnerAssessmentItem) => {
  switch (item.status) {
    case "InProgress":
      return { label: "In progress", tone: "info" as const };
    case "AwaitingResult":
      return { label: "Awaiting result", tone: "warning" as const };
    case "Completed":
      return item.passed
        ? { label: "Passed", tone: "success" as const }
        : { label: "Not passed", tone: "error" as const };
    default:
      // BR-153: nothing submitted is "not completed", never "failed".
      return { label: "Not started", tone: "neutral" as const };
  }
};

const CourseAssessments = () => {
  const { enrollmentId = "" } = useParams();
  const navigate = useNavigate();
  const curriculum = useApiQuery((signal) => fetchCurriculum(enrollmentId, signal), [enrollmentId]);
  const courseId = curriculum.status === "success" ? curriculum.data.courseId : null;

  const [list, setList] = useState<ILearnerAssessmentList | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!courseId) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      setErrorMessage("");
      try {
        const res = await fetchLearnerAssessmentsAPI(courseId);
        if (!active) return;
        // The axios interceptor resolves HTTP errors too, so only res.data tells success apart.
        if (res.data) setList(res.data);
        else setErrorMessage(assessmentErrorText(res, "Unable to load the Assessments."));
      } catch {
        if (active) setErrorMessage("Unable to reach the Assessment service. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [courseId, reloadKey]);

  if (curriculum.status === "loading") return <LearnerSkeleton variant="detail" />;
  if (curriculum.status === "error") {
    return (
      <LearningError error={curriculum.error} context="curriculum" enrollmentId={enrollmentId} onRetry={curriculum.reload} />
    );
  }

  const base = `/learner/courses/${encodeURIComponent(enrollmentId)}`;

  const action = (item: ILearnerAssessmentItem) => {
    const locked = item.attempts.lockedUntil !== null;
    if (item.kind === "QUIZ") {
      // Taking a Quiz is UC29.1; until then the row only shows the state.
      return (
        <Tooltip title="Taking a Quiz is coming soon.">
          <span>
            <LearnerButton disabled>{locked ? "Locked" : "Start Quiz"}</LearnerButton>
          </span>
        </Tooltip>
      );
    }
    const submitted = item.status !== "NotStarted";
    if (list?.readOnly) {
      return <LearnerButton onClick={() => navigate(`${base}/assignments/${item.id}/submit`)}>View</LearnerButton>;
    }
    if (locked) {
      return <LearnerButton disabled>Locked</LearnerButton>;
    }
    // UC30.1: there is no limit on resubmissions, so a submitted Assignment can always be replaced.
    if (submitted) {
      return (
        <LearnerButton onClick={() => navigate(`${base}/assignments/${item.id}/resubmit`)}>Resubmit</LearnerButton>
      );
    }
    return (
      <LearnerButton type="primary" onClick={() => navigate(`${base}/assignments/${item.id}/submit`)}>
        Start Assignment
      </LearnerButton>
    );
  };

  return (
    <>
      <PageHeader
        eyebrow="COURSE / ASSESSMENTS"
        title="Assessments"
        subtitle="Quizzes and Assignments of this Course."
        back
      />
      <InfoPanel title="How results are recorded">
        Quiz uses your best attempt; Assignment uses your latest submission. Submitting several times in a row pauses
        that Assessment for a while.
      </InfoPanel>
      {list?.readOnly && (
        <InfoPanel title="Course completed">This Course is completed, so its Assessments are read-only.</InfoPanel>
      )}
      <div className="course-learning-content">
        <div className="course-assessments-table-card">
          {errorMessage ? (
            <div className="course-assessments-error">
              <strong>The Assessments could not be loaded</strong>
              <p>{errorMessage}</p>
              <LearnerButton onClick={() => setReloadKey((key) => key + 1)}>Try again</LearnerButton>
            </div>
          ) : (
            <table className="course-assessments-table">
              <thead>
                <tr>
                  <th>Assessment</th>
                  <th>Requirement</th>
                  <th>Passing score</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Tries left</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7}>Loading Assessments...</td>
                  </tr>
                )}
                {!loading && list?.items.length === 0 && (
                  <tr>
                    <td colSpan={7}>No Assessments are configured for this Course.</td>
                  </tr>
                )}
                {!loading &&
                  list?.items.map((item) => {
                    const view = statusView(item);
                    const locked = item.attempts.lockedUntil !== null;
                    return (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.title}</strong>
                          <small className="course-assessments-kind">
                            {item.kind === "QUIZ"
                              ? item.timeLimitMinutes
                                ? `Quiz, ${item.timeLimitMinutes} min`
                                : "Quiz"
                              : item.expectedDurationMinutes
                                ? `Assignment, about ${item.expectedDurationMinutes} min`
                                : "Assignment"}
                          </small>
                        </td>
                        <td>{item.isRequired ? "Required" : "Optional"}</td>
                        <td>{item.passingScore}%</td>
                        <td>
                          <StatusTag tone={view.tone}>{view.label}</StatusTag>
                        </td>
                        <td>{item.recordedScore === null ? "-" : `${item.recordedScore}%`}</td>
                        <td>
                          {locked ? (
                            <Tooltip title={`You can try again at ${formatTime(item.attempts.lockedUntil!)}`}>
                              <span className="course-assessments-locked">
                                <LockOutlined /> Opens {formatTime(item.attempts.lockedUntil!)}
                              </span>
                            </Tooltip>
                          ) : (
                            `${item.attempts.remainingAttempts} of ${item.attempts.maxConsecutiveAttempts}`
                          )}
                        </td>
                        <td>{action(item)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
          <p className="course-assessments-footnote">
            After a set number of submissions in a row an Assessment pauses for a few hours, then opens again with a
            fresh count.
          </p>
        </div>
      </div>
    </>
  );
};

export default CourseAssessments;
