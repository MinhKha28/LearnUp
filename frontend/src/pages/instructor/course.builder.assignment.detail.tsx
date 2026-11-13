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
  const isSubmitted = course.status === "Submitted";

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
        else message.error(assessmentErrorText(res, "Không thể tải thông tin bài tập."));
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
          <h1>{loading ? "Đang tải bài tập..." : "Không tìm thấy bài tập"}</h1>
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
        message.error("Không thể tải tệp xuống.");
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
        Biên soạn khóa học / {restricted ? "Không thể chỉnh sửa bài tập" : "Chi tiết bài tập"}
      </span>
      <div className="builder-hero">
        <h1>{assignment.title}</h1>
      </div>

      {assignment.disabled && (
        <div className="builder-banner builder-banner-error">
          <strong>Bài tập đã vô hiệu hóa</strong>
          <p>
            Bài tập bị vô hiệu hóa sau khi xác nhận vi phạm. Bài tập tạm thời không được tính vào điều kiện cấp chứng chỉ cho đến khi được kích hoạt lại; điểm đã ghi nhận vẫn được giữ nguyên.
          </p>
        </div>
      )}

      {/* BR-185: the on/off switch is only available until the Course is Locked, so remind while it still can be set. */}
      {!peerReview.enabled && !assignment.courseLocked && (
        <div className="builder-banner">
          <strong>Chưa bật chấm chéo</strong>
          <p>
            Giảng viên sẽ chấm trực tiếp bài nộp. Bạn có thể bật chấm chéo trước khi khóa học bị khóa (khi học viên đầu tiên tham gia); sau đó không thể bật hoặc tắt.
          </p>
        </div>
      )}

      {restricted && (
        <div className="builder-banner">
          <strong>Đã có dữ liệu bài nộp</strong>
          <p>
            Không thể sửa hướng dẫn, tiêu chí chấm, số lượt nộp liên tiếp và thời gian khóa tạm. Chỉ có thể sửa thời lượng dự kiến thực hiện.
          </p>
        </div>
      )}

      <div className="builder-param-grid">
        <Param label="Điểm đạt" value={`${assignment.passingScore} / 100`} hint="Điểm tối thiểu để đạt" />
        <Param
          label="Thời gian làm bài dự kiến"
          value={formatMinutes(assignment.expectedDurationMinutes)}
          hint="Tính vào thời lượng khóa học"
        />
        <Param
          label="Số lần nộp liên tiếp (n)"
          value={String(assignment.maxConsecutiveAttempts)}
          hint="Số lần nộp trước khi tạm khóa"
        />
        <Param label="Thời gian khóa tạm (giờ)" value={`${assignment.lockoutHours} h`} hint="Áp dụng cho từng học viên, sau đó đặt lại lượt nộp" />
        <Param
          label="Chấm chéo"
          value={peerReview.enabled ? "On" : "Off"}
          hint={
            peerReview.enabled
              ? `${peerReview.reviewersPerSubmission ?? "?"} người chấm cho mỗi bài nộp`
              : "Giảng viên chấm trực tiếp"
          }
          tone={peerReview.enabled ? "on" : "off"}
        />
        <Param
          label="Tiêu chí chấm"
          value={`${assignment.rubric.length} ${assignment.rubric.length === 1 ? "tiêu chí" : "tiêu chí"}`}
          hint={`${totalPoints} points in total`}
        />
      </div>

      <div className="builder-grid">
        <div className="builder-update-card">
          <h2>Hướng dẫn</h2>
          <p className="builder-lesson-intro builder-prompt">{assignment.prompt || "Chưa có hướng dẫn làm bài."}</p>
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
            {isSubmitted ? null : restricted ? (
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
              Không có hạn nộp riêng. Sau <strong>{assignment.maxConsecutiveAttempts}</strong> lượt nộp liên tiếp, học viên bị tạm khóa trong <strong>{assignment.lockoutHours} h</strong>, sau đó có thể tiếp tục nộp bài. Điểm của bài nộp mới nhất là điểm được ghi nhận.
            </p>
          </div>
          <div className="builder-side-card">
            <h3>Chấm chéo</h3>
            {peerReview.enabled ? (
              <ul>
                <li>{peerReview.reviewersPerSubmission ?? "?"} người chấm cho mỗi bài nộp</li>
                <li>{peerReview.cycleDays ?? "?"} ngày/chu kỳ</li>
                <li>{peerReview.deadlineDays ?? "?"} ngày để hoàn thành chấm sau khi chốt chu kỳ</li>
                <li>Ngưỡng chênh lệch điểm: {peerReview.scoreGap ?? "?"}</li>
              </ul>
            ) : (
              <p>
                Chưa bật chấm chéo cho bài tập này.
                {assignment.courseLocked && " Không thể bật lại vì khóa học đã khóa."}
              </p>
            )}
            <InstructorButton disabled={isSubmitted} onClick={() => navigate(`${base}/assignments/${assignment.id}/peer-review`, { state: location.state })}>
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
