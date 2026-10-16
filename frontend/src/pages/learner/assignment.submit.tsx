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
  submitAssignmentAPI,
} from "@/services/assessment.service";
import type { ILearnerAssignment } from "@/types/assessment.types";
import "./assignment.submit.scss";

// UC30 step 2: one PDF, DOCX or ZIP of at most 50 MB. The server checks the file again.
const FILE_EXTENSIONS = ["pdf", "docx", "zip"];
const FILE_MAX_BYTES = 50 * 1024 * 1024;
const CONTENT_MAX_LENGTH = 20000;

const formatTime = (iso: string) => new Date(iso).toLocaleString();

const AssignmentSubmit = () => {
  const { enrollmentId: courseId, assignmentId } = useParams();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState<ILearnerAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [answer, setAnswer] = useState("");
  const [file, setFile] = useState<File | null>(null);

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

  if (!assignment) {
    return (
      <PageHeader
        eyebrow="ASSESSMENTS / SUBMIT"
        title={loading ? "Loading Assignment..." : "Assignment unavailable"}
        subtitle={loadError || "Please wait."}
        back
      />
    );
  }

  const { attempts } = assignment;
  const locked = attempts.lockedUntil !== null;
  const submitted = assignment.latestSubmission !== null;
  // PRE-1 / PRE-2 of UC30 and BR-169; resubmitting arrives with UC30.1.
  const blocked = locked || assignment.readOnly || submitted;

  const pickFile = (picked: File) => {
    const extension = picked.name.split(".").pop()?.toLowerCase() ?? "";
    if (!FILE_EXTENSIONS.includes(extension)) {
      message.error("Attach a PDF, DOCX or ZIP file.");
    } else if (picked.size > FILE_MAX_BYTES) {
      message.error("The file must be 50 MB or smaller.");
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

  const submit = async () => {
    if (!answer.trim() && !file) {
      message.warning("Write your answer or attach a file before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitAssignmentAPI(assignment.id, answer, file);
      if (res.data) {
        navigate(`/learner/courses/${courseId}/assignments/${assignment.id}/submitted`, {
          state: { receipt: res.data, title: assignment.title },
        });
        return;
      }
      message.error(assessmentErrorText(res, "Unable to submit the Assignment."));
      // The state may have changed (locked, submitted elsewhere): show the real one.
      if (["ASSESSMENT_LOCKED", "SUBMISSION_EXISTS", "ENROLLMENT_COMPLETED"].includes(assessmentErrorCode(res).code ?? "")) {
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
        eyebrow="ASSESSMENTS / SUBMIT"
        title={`Submit ${assignment.title}`}
        subtitle="Complete your answer and attach your work."
        back
      />
      <div className="course-learning-main">
        <div className="course-learning-content assignment-submit-card">
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
          {submitted && !assignment.readOnly && (
            <WarningPanel title="Already submitted">
              You submitted this Assignment on {formatTime(assignment.latestSubmission!.submittedAt)}. Submitting again is
              not available yet.
            </WarningPanel>
          )}

          <h3>Instructions</h3>
          <div className="assignment-submit-prompt">
            {assignment.prompt ? <p>{assignment.prompt}</p> : <p>Read the attached file and answer it.</p>}
            {assignment.promptFile && (
              <LearnerButton icon={<DownloadOutlined />} onClick={downloadPrompt}>
                {assignment.promptFile.fileName}
              </LearnerButton>
            )}
          </div>

          <h3>Rubric</h3>
          <ul className="assignment-submit-rubric">
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

          <h3>Your answer</h3>
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
            Your latest submission determines the recorded Assignment score.
          </InfoPanel>
          <div className="assignment-submit-actions">
            <LearnerButton type="primary" loading={submitting} disabled={blocked} onClick={submit}>
              Submit work
            </LearnerButton>
          </div>
        </div>
        <div className="course-learning-side">
          <div className="assignment-submit-info">
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

export default AssignmentSubmit;
