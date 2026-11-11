import { DeleteOutlined, WarningOutlined } from "@ant-design/icons";
import { message } from "antd";
import { useEffect, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import type { ICourseBuilderOutletContext } from "@/components/layout/layout.instructor.course";
import { InstructorButton, InstructorPage } from "@/components/instructor/instructor.ui";
import { assessmentErrorText, deleteQuizAPI, fetchQuizzesAPI } from "@/services/assessment.service";
import type { IQuizSummary } from "@/types/assessment.types";
import "./course.builder.scss";
import "./course.builder.assignment.scss";
import "./course.builder.confirm.scss";

const CourseBuilderQuizDelete = () => {
  const { courseId, quizId } = useParams();
  const navigate = useNavigate();
  const { structure } = useOutletContext<ICourseBuilderOutletContext>();
  const course = structure.course;
  const base = `/instructor/courses/${course.id}/builder`;

  const [quiz, setQuiz] = useState<IQuizSummary | null>(null);
  const [courseLocked, setCourseLocked] = useState(false);
  const [courseStatus, setCourseStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  // There is no single-Quiz endpoint yet (UC18.1), so the Quiz is found in the list of the Course.
  useEffect(() => {
    if (!courseId || !quizId) return;
    let active = true;
    const load = async () => {
      try {
        const res = await fetchQuizzesAPI(courseId);
        if (!active) return;
        if (res.data) {
          setQuiz(res.data.items.find((item) => item.id === quizId) ?? null);
          setCourseLocked(res.data.courseLocked);
          setCourseStatus(res.data.courseStatus);
        } else {
          message.error(assessmentErrorText(res, "Không thể tải bài trắc nghiệm."));
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
  }, [courseId, quizId]);

  if (!quiz) {
    return (
      <InstructorPage className="builder-page">
        <span className="builder-crumb">Xây dựng khóa học / Xóa bài trắc nghiệm</span>
        <div className="builder-hero">
          <h1>{loading ? "Đang tải bài trắc nghiệm..." : "Không tìm thấy bài trắc nghiệm"}</h1>
        </div>
        {!loading && <InstructorButton onClick={() => navigate(`${base}/quizzes`)}>Quay lại</InstructorButton>}
      </InstructorPage>
    );
  }

  // BR-92: blocked only when the Course is Locked AND the Quiz already has attempts.
  const blockedByData = courseLocked && quiz.hasAttempts;
  // BR-285: a Course in review accepts no change.
  const submitted = courseStatus === "Submitted";
  const canDelete = !blockedByData && !submitted;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await deleteQuizAPI(quiz.id);
      if (!res.data) {
        message.error(assessmentErrorText(res, "Không thể xóa bài trắc nghiệm."));
        return;
      }
      message.success("Đã xóa bài trắc nghiệm.");
      navigate(`${base}/quizzes`);
    } catch {
      message.error("Không thể kết nối dịch vụ Đánh giá. Vui lòng thử lại.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Xây dựng khóa học / Xóa bài trắc nghiệm</span>
      <div className="builder-hero">
        <h1>Xóa bài trắc nghiệm</h1>
      </div>
      <div className="builder-confirm-card builder-delete-card">
        <div className="builder-delete-head">
          <span className="builder-delete-icon">
            <DeleteOutlined />
          </span>
          <div>
            <strong>Delete "{quiz.title}"?</strong>
            <p>Thao tác này không thể hoàn tác.</p>
          </div>
        </div>

        <div className="builder-delete-list">
          <span>Thao tác sẽ xóa vĩnh viễn:</span>
          <ul>
            <li>
              The Quiz and its {quiz.questionCount} question{quiz.questionCount === 1 ? "" : "s"}
            </li>
            {quiz.hasAttempts && <li>Toàn bộ lượt làm và câu trả lời của học viên trong bài trắc nghiệm này</li>}
          </ul>
        </div>

        {blockedByData && (
          <p className="builder-delete-blocked">
            <WarningOutlined /> Bài trắc nghiệm đã có lượt làm và khóa học đã khóa nên không thể xóa.
            Hãy tạo phiên bản khóa học mới để xóa bài trắc nghiệm.
          </p>
        )}
        {submitted && (
          <p className="builder-delete-blocked">
            <WarningOutlined /> Khóa học đang chờ thẩm định nên không thể chỉnh sửa cho đến khi thu hồi.
          </p>
        )}
        <div className="builder-confirm-actions">
          <InstructorButton onClick={() => navigate(`${base}/quizzes`)}>Hủy</InstructorButton>
          <InstructorButton type="primary" danger disabled={!canDelete} loading={deleting} onClick={handleDelete}>
            Xóa bài trắc nghiệm
          </InstructorButton>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderQuizDelete;
