import { formatNumberVN } from "@/utils/number.format";
import { formatDateTimeVN } from "@/utils/helper";
import { useCallback, useEffect, useState } from "react";
import { Input, Upload, message } from "antd";
import { DownloadOutlined, InboxOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { DetailItem, InfoPanel, LearnerButton, PageHeader, WarningPanel } from "@/components/learner/learner.ui";
import {
  assessmentErrorCode,
  learnerAssessmentErrorText,
  ENROLLMENT_NOT_ACTIVE_FORM_TEXT,
  downloadLearnerPromptFileAPI,
  fetchLearnerAssignmentAPI,
  resubmitAssignmentAPI,
  submitAssignmentAPI,
} from "@/services/assessment.service";
import type { ILearnerAssignment } from "@/types/assessment.types";
import { formatFileSize } from "@/utils/submission.labels";
import "./assignment.work.scss";

// UC30 step 2: one PDF, DOCX or ZIP. The size limit comes with the Assignment (`maxFileBytes`: the 50 MB ceiling lowered
// to the storage plan). The server checks the file again.
const FILE_EXTENSIONS = ["pdf", "docx", "zip"];
const CONTENT_MAX_LENGTH = 20000;
// MSG20
const fileMessage = (maxBytes: number) => `Tệp phải là PDF, DOCX hoặc ZIP, tối đa ${formatFileSize(maxBytes)}.`;
// the answers that mean the page shows an old state: load it again
// ENROLLMENT_COMPLETED: the Enrollment changed while the form was open, and the GET still answers (read-only).
const STALE_CODES = ["ASSESSMENT_LOCKED", "SUBMISSION_EXISTS", "NO_PREVIOUS_SUBMISSION", "ENROLLMENT_COMPLETED"];
// ENROLLMENT_NOT_ACTIVE (Halted, Withdrawn): the GET is refused too, so there is nothing to reload; the form stays,
// with the draft, and is closed.
const NOT_ACTIVE_CODE = "ENROLLMENT_NOT_ACTIVE";

const formatTime = (iso: string) => formatDateTimeVN(iso);

/** UC30.1: tells the Learner, before sending, where the new work will go (BR-171, BR-313). */
const resubmissionNotice = (assignment: ILearnerAssignment) => {
  const outlook = assignment.resubmission;
  if (!outlook) return null;
  if (outlook.placement === "REPLACES_IN_CYCLE" && outlook.cycleClosesAt) {
    return `Bài làm mới của bạn thay thế bài nộp trước trong chu kỳ chấm chéo sẽ đóng lúc ${formatTime(outlook.cycleClosesAt)}.`;
  }
  if (outlook.placement === "OPEN_CYCLE") {
    return "Bạn đã bỏ lỡ các bài chấm của chu kỳ trước, nên bài làm mới sẽ vào chu kỳ chấm chéo đang mở và bạn có thể chấm bù.";
  }
  return assignment.peerReviewEnabled
    ? "Chu kỳ chấm chéo của bài nộp trước đã đóng, nên giảng viên sẽ chấm thẳng bài làm mới."
    : "Giảng viên sẽ chấm bài làm mới.";
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
  const [notActive, setNotActive] = useState("");
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
        setLoadError(learnerAssessmentErrorText(res));
      }
    } catch {
      setLoadError("Không kết nối được dịch vụ Đánh giá. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const eyebrow = resubmitting ? "Bài đánh giá / Nộp lại" : "Bài đánh giá / Nộp bài";
  if (!assignment) {
    return (
      <PageHeader
        eyebrow={eyebrow}
        title={loading ? "Đang tải bài tập..." : "Chưa mở được bài tập"}
        subtitle={loadError || "Vui lòng đợi."}
        back
      />
    );
  }

  const { attempts } = assignment;
  const locked = attempts.lockedUntil !== null;
  const previous = assignment.latestSubmission;
  const submitted = previous !== null;
  // PRE-1 / PRE-2 of UC30 and UC30.1, and BR-210. UC30 is for the first submission, UC30.1 needs one to replace.
  const blocked = locked || assignment.readOnly || notActive !== "" || (resubmitting ? !submitted : submitted);
  const notice = resubmitting ? resubmissionNotice(assignment) : null;

  const pickFile = (picked: File) => {
    const extension = picked.name.split(".").pop()?.toLowerCase() ?? "";
    if (!FILE_EXTENSIONS.includes(extension) || picked.size > assignment.maxFileBytes) {
      message.error(
        FILE_EXTENSIONS.includes(extension)
          ? `Tệp quá lớn. Dung lượng tối đa là ${formatFileSize(assignment.maxFileBytes)}.`
          : fileMessage(assignment.maxFileBytes),
      );
    } else {
      setFile(picked);
    }
    return false; // the file is sent with the form, not uploaded on its own
  };

  const downloadPrompt = async () => {
    const blob = await downloadLearnerPromptFileAPI(assignment.id);
    if (!blob) {
      message.error("Không tải được tệp.");
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
      message.warning("Cần nhập câu trả lời hoặc đính kèm tệp.");
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
      // The state may have changed (locked, submitted elsewhere): show the real one.
      const code = assessmentErrorCode(res).code ?? "";
      if (code === NOT_ACTIVE_CODE) {
        message.error(ENROLLMENT_NOT_ACTIVE_FORM_TEXT);
        setNotActive(ENROLLMENT_NOT_ACTIVE_FORM_TEXT);
        return;
      }
      message.error(learnerAssessmentErrorText(res));
      if (STALE_CODES.includes(code)) {
        await load();
      }
    } catch {
      message.error("Không kết nối được dịch vụ Đánh giá. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow={eyebrow}
        title={`${resubmitting ? "Nộp lại" : "Nộp bài"}: ${assignment.title}`}
        subtitle={
          resubmitting
            ? "Bài nộp mới thay thế bài nộp trước; bài nộp mới nhất được tính."
            : "Hoàn thành câu trả lời và đính kèm bài làm của bạn."
        }
        back
      />
      <div className="course-learning-main">
        <div className="course-learning-content assignment-work-card">
          {locked && (
            <WarningPanel title="Tạm dừng nộp bài">
              Bạn đã nộp {attempts.maxConsecutiveAttempts} lần liên tiếp. Bạn có thể nộp lại lúc{" "}
              {formatTime(attempts.lockedUntil!)}.
            </WarningPanel>
          )}
          {notActive && <WarningPanel title="Không thể nộp bài">{notActive}</WarningPanel>}
          {assignment.readOnly && (
            <WarningPanel title="Khóa học đã hoàn thành">
              Khóa học này đã hoàn thành nên bài tập chỉ để xem.
            </WarningPanel>
          )}
          {!resubmitting && submitted && !assignment.readOnly && (
            <WarningPanel title="Đã nộp bài">
              Bạn đã nộp bài tập này lúc {formatTime(previous.submittedAt)}. Bạn có thể thay nó bằng một bài nộp
              mới.
              <span className="assignment-work-action">
                <LearnerButton type="primary" onClick={() => navigate(`${base}/resubmit`)}>
                  Nộp lại
                </LearnerButton>
              </span>
            </WarningPanel>
          )}
          {resubmitting && !submitted && (
            <WarningPanel title="Chưa có gì để nộp lại">
              Bạn chưa nộp bài tập này.
              <span className="assignment-work-action">
                <LearnerButton type="primary" onClick={() => navigate(`${base}/submit`)}>
                  Nộp bài
                </LearnerButton>
              </span>
            </WarningPanel>
          )}
          {resubmitting && previous && !assignment.readOnly && (
            <div className="assignment-work-previous">
              <strong>Bài nộp trước của bạn</strong>
              <span>
                Lần nộp thứ {previous.submissionNumber}, nộp lúc {formatTime(previous.submittedAt)}
                {previous.fileName ? `, kèm ${previous.fileName}` : ""}.
              </span>
              {notice && <span>{notice}</span>}
            </div>
          )}

          <h3>Hướng dẫn</h3>
          <div className="assignment-work-prompt">
            {assignment.prompt ? <p>{assignment.prompt}</p> : <p>Đọc tệp đính kèm và trả lời.</p>}
            {assignment.promptFile && (
              <LearnerButton icon={<DownloadOutlined />} onClick={downloadPrompt}>
                {assignment.promptFile.fileName}
              </LearnerButton>
            )}
          </div>

          <h3>Tiêu chí chấm điểm</h3>
          <ul className="assignment-work-rubric">
            {assignment.rubric.map((criterion) => (
              <li key={criterion.id}>
                <div>
                  <strong>{criterion.name}</strong>
                  <span>{criterion.description}</span>
                </div>
                <em>{formatNumberVN(criterion.maxPoints)} điểm</em>
              </li>
            ))}
          </ul>

          <h3>{resubmitting ? "Câu trả lời mới của bạn" : "Câu trả lời của bạn"}</h3>
          <Input.TextArea
            rows={8}
            value={answer}
            maxLength={CONTENT_MAX_LENGTH}
            disabled={blocked}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder="Viết câu trả lời của bạn tại đây..."
          />
          <h3>Tệp đính kèm</h3>
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
            <p className="ant-upload-text">{file ? file.name : "Tải bài làm của bạn lên"}</p>
            <p className="ant-upload-hint">PDF, DOCX hoặc ZIP, tối đa {formatFileSize(assignment.maxFileBytes)}. Một tệp.</p>
          </Upload.Dragger>
          <InfoPanel title="Kết quả đánh giá">
            Bài nộp mới nhất quyết định điểm bài tập được ghi nhận. Số lần nộp lại không bị giới hạn cho đến khi
            khóa học hoàn thành.
          </InfoPanel>
          <div className="assignment-work-actions">
            <LearnerButton type="primary" loading={submitting} disabled={blocked} onClick={send}>
              {resubmitting ? "Nộp lại bài" : "Nộp bài"}
            </LearnerButton>
          </div>
        </div>
        <div className="course-learning-side">
          <div className="assignment-work-info">
            <h3>Thông tin nộp bài</h3>
            <DetailItem label="Thời gian dự kiến">
              {assignment.expectedDurationMinutes ? `${assignment.expectedDurationMinutes} phút` : "Chưa đặt"}
            </DetailItem>
            <DetailItem label="Điểm đạt tối thiểu">{formatNumberVN(assignment.passingScore)}%</DetailItem>
            <DetailItem label="Số lượt còn lại trước khi tạm khóa">
              {attempts.remainingAttempts}/{attempts.maxConsecutiveAttempts}
            </DetailItem>
            <DetailItem label="Quy tắc khóa">
              Nộp {attempts.maxConsecutiveAttempts} lượt liên tiếp thì tạm khóa {attempts.lockoutHours} giờ
            </DetailItem>
            <DetailItem label="Cách chấm">
              {assignment.peerReviewEnabled ? "Chấm chéo, rồi giảng viên chấm" : "Giảng viên chấm"}
            </DetailItem>
          </div>
        </div>
      </div>
    </>
  );
};

export default AssignmentWork;
