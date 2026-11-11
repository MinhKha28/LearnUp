import { message } from "antd";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams, useOutletContext } from "react-router-dom";
import type { ICourseBuilderOutletContext } from "@/components/layout/layout.instructor.course";
import { InstructorButton, InstructorPage } from "@/components/instructor/instructor.ui";
import { assessmentErrorText, downloadPromptFileAPI, fetchAssignmentAPI } from "@/services/assessment.service";
import type { IAssignment } from "@/types/assessment.types";
import { formatFileSize, formatMinutes } from "@/utils/helper";
import "./course.builder.scss";
import "./course.builder.assignment.scss";

type TParamProps = { label: string; value: string; hint: string; tone?: "on" | "off" };

const Param = ({ label, value, hint, tone }: TParamProps) => (
  <div className={`builder-param-card${tone ? ` builder-param-card-${tone}` : ""}`}>
    <span>{label}</span>
    <strong>{value}</strong>
    <small>{hint}</small>
  </div>
);

const CourseBuilderAssignmentDetail = () => {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { structure } = useOutletContext<ICourseBuilderOutletContext>();
  const course = structure.course;

  const [assignment, setAssignment] = useState<IAssignment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!assignmentId) return;
    let active = true;
    const load = async () => {
      try {
        const res = await fetchAssignmentAPI(assignmentId);
        if (!active) return;
        if (res.data) setAssignment(res.data);
        else message.error(assessmentErrorText(res, "Unable to load the Assignment."));
      } catch {
        if (active) message.error("Không thể kết nối dịch vụ Đánh giá. Vui lòng thử lại.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [assignmentId]);


  const base = `/instructor/courses/${course.id}/builder`;
  // Back goes to the screen the user opened this Assignment from (outline, list, ...); direct visits fall back to the list.
  const backPath = (location.state as { from?: string } | null)?.from ?? `${base}/assignments`;

  if (!assignment) {
    return (
      <InstructorPage className="builder-page">
        <span className="builder-crumb">Xây dựng khóa học / Chi tiết bài tập</span>
        <div className="builder-hero">
          <h1>{loading ? "Loading Assignment..." : "Assignment not found"}</h1>
        </div>
        {!loading && <InstructorButton onClick={() => navigate(backPath)}>Quay lại</InstructorButton>}
      </InstructorPage>
    );
  }

  const { peerReview } = assignment;
  const handleDownload = async () => {
    if (!assignment.promptFile) return;
    try {
      const blob = await downloadPromptFileAPI(assignment.id);
      if (!blob) {
        message.error("Unable to download the file.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = assignment.promptFile.fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      message.error("Không thể kết nối dịch vụ Đánh giá. Vui lòng thử lại.");
    }
  };
  const totalPoints = assignment.rubric.reduce((sum, criterion) => sum + criterion.maxPoints, 0);
  // BR-98: once a submission exists only the estimated effort can change (BR-173, UC19.3).
  const restricted = assignment.locked;
  const editPath = `${base}/assignments/${assignment.id}/edit`;

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">
        Course Builder / {restricted ? "Assignment Editing Restricted" : "Assignment Detail"}
      </span>
      <div className="builder-hero">
        <h1>{assignment.title}</h1>
      </div>

      {assignment.disabled && (
        <div className="builder-banner builder-banner-error">
          <strong>Bài tập đã vô hiệu hóa</strong>
          <p>
            This Assignment was disabled after a confirmed violation. It is left out of the Certificate requirements until
            it is re-enabled; scores already recorded are kept.
          </p>
        </div>
      )}

      {/* BR-185: the on/off switch is only available until the Course is Locked, so remind while it still can be set. */}
      {!peerReview.enabled && !assignment.courseLocked && (
        <div className="builder-banner">
          <strong>Chưa bật chấm chéo</strong>
          <p>
            Learners will be graded directly by you. You can turn Peer Review on until the Course is Locked (when the
            first Learner enrolls); after that it can no longer be switched.
          </p>
        </div>
      )}

      {restricted && (
        <div className="builder-banner">
          <strong>Đã có dữ liệu bài nộp</strong>
          <p>
            Instructions, Rubric, n attempts and m-hour lock cannot be edited. Only the estimated effort can still
            change.
          </p>
        </div>
      )}

      <div className="builder-param-grid">
        <Param label="Điểm đạt" value={`${assignment.passingScore} / 100`} hint="Minimum score to pass" />
        <Param
          label="Thời gian làm bài dự kiến"
          value={formatMinutes(assignment.expectedDurationMinutes)}
          hint="Counts toward Course duration"
        />
        <Param
          label="Số lần nộp liên tiếp (n)"
          value={String(assignment.maxConsecutiveAttempts)}
          hint="Attempts before a lock"
        />
        <Param label="Thời gian khóa tạm (m)" value={`${assignment.lockoutHours} h`} hint="Per Learner, then attempts reset" />
        <Param
          label="Chấm chéo"
          value={peerReview.enabled ? "On" : "Off"}
          hint={
            peerReview.enabled
              ? `${peerReview.reviewersPerSubmission ?? "?"} reviewers per submission`
              : "Instructor grades directly"
          }
          tone={peerReview.enabled ? "on" : "off"}
        />
        <Param
          label="Tiêu chí chấm"
          value={`${assignment.rubric.length} ${assignment.rubric.length === 1 ? "criterion" : "criteria"}`}
          hint={`${totalPoints} points in total`}
        />
      </div>

      <div className="builder-grid">
        <div className="builder-update-card">
          <h2>Hướng dẫn</h2>
          <p className="builder-lesson-intro builder-prompt">{assignment.prompt || "No Instructions written yet."}</p>
          {assignment.promptFile && (
            <div className="builder-file-row">
              <span className="builder-file-name">
                {assignment.promptFile.fileName}
                <small> {formatFileSize(assignment.promptFile.sizeBytes)}</small>
              </span>
              <InstructorButton onClick={handleDownload}>Tải PDF</InstructorButton>
            </div>
          )}

          <hr className="builder-divider" />
          <h2>Tiêu chí chấm</h2>
          <div className="builder-rubric-summary">
            {assignment.rubric.map((criterion) => (
              <div className="builder-rubric-line" key={criterion.id}>
                <span>
                  {criterion.position}. {criterion.description}
                </span>
                <strong>{criterion.maxPoints} pts</strong>
              </div>
            ))}
            <div className="builder-rubric-line builder-rubric-total">
              <span>Tổng số</span>
              <strong>{totalPoints} pts</strong>
            </div>
          </div>

          <div className="builder-actions builder-actions-split">
            <InstructorButton onClick={() => navigate(backPath)}>Quay lại</InstructorButton>
            <InstructorButton onClick={() => navigate(`/instructor/submissions?assessmentId=${assignment.id}`)}>Bài nộp</InstructorButton>
            {restricted ? (
              <InstructorButton type="primary" onClick={() => navigate(editPath, { state: location.state })}>
                Chỉnh sửa thời gian làm bài dự kiến
              </InstructorButton>
            ) : (
              <>
                <InstructorButton danger onClick={() => navigate(`${base}/assignments/${assignment.id}/delete`, { state: location.state })}>
                  Xóa bài tập
                </InstructorButton>
                <InstructorButton onClick={() => navigate(editPath, { state: location.state })}>Chỉnh sửa bài tập</InstructorButton>
              </>
            )}
          </div>
        </div>

        <div className="builder-side">
          <div className="builder-side-card">
            <h3>Quy tắc nộp bài</h3>
            <p>
              Không có hạn nộp riêng. Sau <strong>{assignment.maxConsecutiveAttempts}</strong> consecutive submissions
              the Learner is locked for <strong>{assignment.lockoutHours} h</strong>, then can submit again. The latest
              score is the recorded score.
            </p>
          </div>
          <div className="builder-side-card">
            <h3>Chấm chéo</h3>
            {peerReview.enabled ? (
              <ul>
                <li>{peerReview.reviewersPerSubmission ?? "?"} reviewers per submission</li>
                <li>{peerReview.cycleDays ?? "?"}-day cycle</li>
                <li>{peerReview.deadlineDays ?? "?"}-day review deadline after the cycle closes</li>
                <li>Score gap threshold: {peerReview.scoreGap ?? "?"}</li>
              </ul>
            ) : (
              <p>
                Disabled for this Assignment.
                {assignment.courseLocked && " It can no longer be turned on because the Course is Locked."}
              </p>
            )}
            <InstructorButton onClick={() => navigate(`${base}/assignments/${assignment.id}/peer-review`, { state: location.state })}>
              Thiết lập chấm chéo
            </InstructorButton>
            {peerReview.enabled && (
              <InstructorButton onClick={() => navigate(`${base}/assignments/${assignment.id}/peer-cycles`, { state: location.state })}>
                Xem chu kỳ
              </InstructorButton>
            )}
          </div>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderAssignmentDetail;
