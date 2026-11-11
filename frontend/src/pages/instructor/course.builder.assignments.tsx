import { message } from "antd";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams, useOutletContext } from "react-router-dom";
import type { ICourseBuilderOutletContext } from "@/components/layout/layout.instructor.course";
import { InfoPanel, InstructorButton, InstructorPage } from "@/components/instructor/instructor.ui";
import { assessmentErrorText, fetchAssignmentsAPI } from "@/services/assessment.service";
import type { IAssignmentSummary } from "@/types/assessment.types";
import { formatMinutes } from "@/utils/helper";
import "./course.builder.scss";
import "./course.builder.assignment.scss";

const CourseBuilderAssignments = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { structure } = useOutletContext<ICourseBuilderOutletContext>();
  const course = structure.course;

  const [assignments, setAssignments] = useState<IAssignmentSummary[]>([]);
  const [courseLocked, setCourseLocked] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!courseId) return;
    let active = true;
    const load = async () => {
      try {
        const res = await fetchAssignmentsAPI(courseId);
        if (!active) return;
        if (res.data) {
          setAssignments(res.data.items);
          setCourseLocked(res.data.courseLocked);
        } else {
          message.error(assessmentErrorText(res, "Không thể tải danh sách bài tập."));
        }
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
  }, [courseId]);


  const base = `/instructor/courses/${course.id}/builder`;
  // BR-318: no new Assignment once the Course is Locked. Stay disabled until the real Course state is known.
  const addBlocked = courseLocked !== false;

  const withPeerReview = assignments.filter((a) => a.peerReviewEnabled).length;
  const withSubmissions = assignments.filter((a) => a.locked).length;

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Xây dựng khóa học / Bài tập</span>
      <div className="builder-hero">
        <h1>Bài tập</h1>
        <p>
          {loading ? "Đang tải..." : `${assignments.length} bài tập trong ${course.name}`}
        </p>
      </div>
      <div className="builder-grid">
        <div className="builder-update-card builder-assign-card">
          <div className="builder-assign-stats">
            <div>
              <strong>{assignments.length}</strong>
              <span>Tổng số</span>
            </div>
            <div>
              <strong>{withPeerReview}</strong>
              <span>Đã bật chấm chéo</span>
            </div>
            <div>
              <strong>{withSubmissions}</strong>
              <span>Có bài nộp</span>
            </div>
          </div>

          <div className="builder-assign-list">
            {assignments.map((assignment, index) => (
              <div
                className="builder-assign-item"
                key={assignment.id}
                onClick={() => navigate(`${base}/assignments/${assignment.id}`, { state: { from: pathname } })}
              >
                <span className="builder-assign-index">{index + 1}</span>
                <div className="builder-assign-main">
                  <strong>
                    {assignment.title}
                    {assignment.disabled && " (Đã vô hiệu hóa)"}
                  </strong>
                  <small>
                    Điểm đạt {assignment.passingScore}% · khoảng {formatMinutes(assignment.expectedDurationMinutes).replaceAll("min", "phút").replaceAll(" h", " giờ")}
                  </small>
                  <small>
                    {assignment.maxConsecutiveAttempts} lượt nộp liên tiếp, sau đó khóa {assignment.lockoutHours} giờ
                  </small>
                </div>
                <div className="builder-assign-tags">
                  <em className={`builder-pill${assignment.peerReviewEnabled ? " builder-pill-on" : ""}`}>
                    Chấm chéo: {assignment.peerReviewEnabled ? "Bật" : "Tắt"}
                  </em>
                  {/* BR-99: say why an item cannot be edited instead of only showing a state. */}
                  <em className={`builder-pill${assignment.locked ? " builder-pill-warn" : ""}`}>
                    {assignment.locked ? "Đã có bài nộp" : "Chưa khóa"}
                  </em>
                </div>
                <span className="builder-assign-chevron">&rsaquo;</span>
              </div>
            ))}
            {!loading && assignments.length === 0 && (
              <div className="builder-assign-empty">Chưa có bài tập. Hãy thêm bài tập đầu tiên để bắt đầu.</div>
            )}
            {loading && <div className="builder-assign-empty">Đang tải bài tập...</div>}
          </div>

          {courseLocked && (
            <div className="builder-banner">
              <strong>Khóa học đã khóa</strong>
              <p>
                Đã có học viên đăng ký nên không thể thêm bài tập. Hãy tạo phiên bản khóa học mới.
              </p>
            </div>
          )}
          <div className="builder-actions builder-actions-split">
            <InstructorButton onClick={() => navigate(base)}>Quay lại cấu trúc khóa học</InstructorButton>
            <InstructorButton
              type="primary"
              disabled={addBlocked}
              onClick={() => navigate(`${base}/assignments/new`, { state: { from: pathname } })}
            >
              + Thêm bài tập
            </InstructorButton>
          </div>
        </div>
        <div className="builder-side">
          <InfoPanel title="Bài đánh giá cấp khóa học">
            Mọi bài tập đều là điều kiện bắt buộc để hoàn thành chứng chỉ.
          </InfoPanel>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderAssignments;
