import { useCallback, useEffect, useState } from "react";
import { Input, Upload, message } from "antd";
import { DownloadOutlined, InboxOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { DetailItem, InfoPanel, LearnerButton, PageHeader, WarningPanel } from "@/components/learner/learner.ui";
import {
  assessmentErrorCode,
  assessmentErrorText,
  downloadLearnerPromptFileAPI,
  fetchLearnerAssignmentAPI,
  resubmitAssignmentAPI,
  submitAssignmentAPI,
} from "@/services/assessment.service";
import type { ILearnerAssignment } from "@/types/assessment.types";
import "./assignment.work.scss";

// UC30 step 2: one PDF, DOCX or ZIP of at most 50 MB. The server checks the file again.
const FILE_EXTENSIONS = ["pdf", "docx", "zip"];
const FILE_MAX_BYTES = 50 * 1024 * 1024;
const CONTENT_MAX_LENGTH = 20000;
// MSG20
const FILE_MESSAGE = "File must be PDF, DOCX or ZIP, at most 50 MB.";
// the answers that mean the page shows an old state: load it again
// ENROLLMENT_COMPLETED and ENROLLMENT_NOT_ACTIVE: the Enrollment changed while the form was open (Completed, or Halted/Withdrawn).
const STALE_CODES = [
  "ASSESSMENT_LOCKED",
  "SUBMISSION_EXISTS",
  "NO_PREVIOUS_SUBMISSION",
  "ENROLLMENT_COMPLETED",
  "ENROLLMENT_NOT_ACTIVE",
];

const formatTime = (iso: string) => new Date(iso).toLocaleString();

/** UC30.1: tells the Learner, before sending, where the new work will go (BR-171, BR-313). */
const resubmissionNotice = (assignment: ILearnerAssignment) => {
  const outlook = assignment.resubmission;
  if (!outlook) return null;
  if (outlook.placement === "REPLACES_IN_CYCLE" && outlook.cycleClosesAt) {
    return `Your new work replaces your previous submission in the peer review cycle that closes on ${formatTime(outlook.cycleClosesAt)}.`;
  }
  if (outlook.placement === "OPEN_CYCLE") {
    return "You skipped the reviews of an earlier cycle, so your new work joins the peer review cycle that is open now and you can make them up.";
  }
  return assignment.peerReviewEnabled
    ? "The peer review cycle of your previous submission has closed, so your Instructor will grade the new work directly."
    : "Your Instructor will grade the new work.";
};

/**
 * UC30 (submit) and UC30.1 (resubmit): the same form, the same file rules; only the call, the texts and the rule that
 * decides whether it can be used differ.
 */
const AssignmentWork = ({ mode }: { mode: "submit" | "resubmit" }) => {
  const { enrollmentId: courseId, assignmentId } = useParams();
  const navigate = useNavigate();
  const resubmitting = mode === "resubmit";
  const [assignment, setAssignment] = useState<ILearnerAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [answer, setAnswer] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const base = `/learner/courses/${courseId}/assignments/${assignmentId}`;

  const load = useCallback(async () => {
    if (!assignmentId) return;
    try {
      const res = await fetchLearnerAssignmentAPI(assignmentId);
      if (res.data) {
        setAssignment(res.data);
        setLoadError("");
      } else {
        setLoadError(assessmentErrorText(res, "Unable to load the Assignment."));
      }
    } catch {
      setLoadError("Unable to reach the Assessment service. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const eyebrow = resubmitting ? "ASSESSMENTS / RESUBMIT" : "ASSESSMENTS / SUBMIT";
  if (!assignment) {
    return (
      <PageHeader
        eyebrow={eyebrow}
        title={loading ? "Loading Assignment..." : "Assignment unavailable"}
        subtitle={loadError || "Please wait."}
        back
      />
    );
  }

  const { attempts } = assignment;
  const locked = attempts.lockedUntil !== null;
  const previous = assignment.latestSubmission;
  const submitted = previous !== null;
  // PRE-1 / PRE-2 of UC30 and UC30.1, and BR-210. UC30 is for the first submission, UC30.1 needs one to replace.
  const blocked = locked || assignment.readOnly || (resubmitting ? !submitted : submitted);
  const notice = resubmitting ? resubmissionNotice(assignment) : null;

  const pickFile = (picked: File) => {
    const extension = picked.name.split(".").pop()?.toLowerCase() ?? "";
    if (!FILE_EXTENSIONS.includes(extension) || picked.size > FILE_MAX_BYTES) {
      message.error(FILE_MESSAGE);
    } else {
      setFile(picked);
    }
    return false; // the file is sent with the form, not uploaded on its own
  };

  const downloadPrompt = async () => {
    const blob = await downloadLearnerPromptFileAPI(assignment.id);
    if (!blob) {
      message.error("Unable to download the file.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = assignment.promptFile?.fileName ?? "prompt.pdf";
    link.click();
    URL.revokeObjectURL(url);
  };

  const send = async () => {
    if (!answer.trim() && !file) {
      message.warning("The answer or file field is required.");
      return;
    }
    setSubmitting(true);
    try {
      const call = resubmitting ? resubmitAssignmentAPI : submitAssignmentAPI;
      const res = await call(assignment.id, answer, file);
      if (res.data) {
        navigate(`${base}/submitted`, { state: { receipt: res.data, title: assignment.title } });
        return;
      }
      message.error(
        assessmentErrorText(res, resubmitting ? "Unable to resubmit the Assignment." : "Unable to submit the Assignment."),
      );
      // The state may have changed (locked, submitted elsewhere): show the real one.
      if (STALE_CODES.includes(assessmentErrorCode(res).code ?? "")) {
        await load();
      }
    } catch {
      message.error("Unable to reach the Assessment service. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow={eyebrow}
        title={`${resubmitting ? "Resubmit" : "Submit"} ${assignment.title}`}
        subtitle={
          resubmitting
            ? "Your new submission replaces the previous one; the latest one counts."
            : "Complete your answer and attach your work."
        }
        back
      />
      <div className="course-learning-main">
        <div className="course-learning-content assignment-work-card">
          {locked && (
            <WarningPanel title="Submitting is paused">
              You have submitted {attempts.maxConsecutiveAttempts} times in a row. You can submit again at{" "}
              {formatTime(attempts.lockedUntil!)}.
            </WarningPanel>
          )}
          {assignment.readOnly && (
            <WarningPanel title="Course completed">
              This Course is completed, so the Assignment is read-only.
            </WarningPanel>
          )}
          {!resubmitting && submitted && !assignment.readOnly && (
            <WarningPanel title="Already submitted">
              You submitted this Assignment on {formatTime(previous.submittedAt)}. You can replace it with a new
              submission.
              <span className="assignment-work-action">
                <LearnerButton type="primary" onClick={() => navigate(`${base}/resubmit`)}>
                  Resubmit
                </LearnerButton>
              </span>
            </WarningPanel>
          )}
          {resubmitting && !submitted && (
            <WarningPanel title="Nothing to resubmit yet">
              You have not submitted this Assignment yet.
              <span className="assignment-work-action">
                <LearnerButton type="primary" onClick={() => navigate(`${base}/submit`)}>
                  Submit work
                </LearnerButton>
              </span>
            </WarningPanel>
          )}
          {resubmitting && previous && !assignment.readOnly && (
            <div className="assignment-work-previous">
              <strong>Your previous submission</strong>
              <span>
                Submission {previous.submissionNumber}, sent on {formatTime(previous.submittedAt)}
                {previous.fileName ? `, with ${previous.fileName}` : ""}.
              </span>
              {notice && <span>{notice}</span>}
            </div>
          )}

          <h3>Instructions</h3>
          <div className="assignment-work-prompt">
            {assignment.prompt ? <p>{assignment.prompt}</p> : <p>Read the attached file and answer it.</p>}
            {assignment.promptFile && (
              <LearnerButton icon={<DownloadOutlined />} onClick={downloadPrompt}>
                {assignment.promptFile.fileName}
              </LearnerButton>
            )}
          </div>

          <h3>Rubric</h3>
          <ul className="assignment-work-rubric">
            {assignment.rubric.map((criterion) => (
              <li key={criterion.id}>
                <div>
                  <strong>{criterion.name}</strong>
                  <span>{criterion.description}</span>
                </div>
                <em>{criterion.maxPoints} pts</em>
              </li>
            ))}
          </ul>

          <h3>{resubmitting ? "Your new answer" : "Your answer"}</h3>
          <Input.TextArea
            rows={8}
            value={answer}
            maxLength={CONTENT_MAX_LENGTH}
            disabled={blocked}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder="Write your response here..."
          />
          <h3>Attachment</h3>
          <Upload.Dragger
            multiple={false}
            disabled={blocked}
            accept=".pdf,.docx,.zip"
            beforeUpload={pickFile}
            showUploadList={false}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">{file ? file.name : "Upload your work"}</p>
            <p className="ant-upload-hint">PDF, DOCX or ZIP, up to 50 MB. One file.</p>
          </Upload.Dragger>
          <InfoPanel title="Assessment result">
            Your latest submission determines the recorded Assignment score. There is no limit on resubmissions until
            the Course is completed.
          </InfoPanel>
          <div className="assignment-work-actions">
            <LearnerButton type="primary" loading={submitting} disabled={blocked} onClick={send}>
              {resubmitting ? "Resubmit work" : "Submit work"}
            </LearnerButton>
          </div>
        </div>
        <div className="course-learning-side">
          <div className="assignment-work-info">
            <h3>Submission information</h3>
            <DetailItem label="Estimated effort">
              {assignment.expectedDurationMinutes ? `${assignment.expectedDurationMinutes} min` : "Not set"}
            </DetailItem>
            <DetailItem label="Minimum score">{assignment.passingScore}%</DetailItem>
            <DetailItem label="Attempts remaining">
              {attempts.remainingAttempts} of {attempts.maxConsecutiveAttempts}
            </DetailItem>
            <DetailItem label="Lock rule">
              {attempts.maxConsecutiveAttempts} in a row pause submitting for {attempts.lockoutHours} h
            </DetailItem>
            <DetailItem label="Grading">
              {assignment.peerReviewEnabled ? "Peer review, then your Instructor" : "Your Instructor"}
            </DetailItem>
          </div>
        </div>
      </div>
    </>
  );
};

export default AssignmentWork;
