import { Alert, message, Skeleton } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  InstructorButton,
  InstructorPage,
  PageHeader,
  SectionCard,
} from "@/components/instructor/instructor.ui";

import {
  fetchCourseDetailAPI,
  submitCourseForApprovalAPI,
} from "@/services/course.service";

import type { ICourseDetail } from "@/types/course.types";

import "./course.submit.scss";
import { getSubmitErrorMessage } from "./course.submit.errors";

const CourseSubmit = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [course, setCourse] = useState<ICourseDetail | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Chặn double-click trước cả khi React cập nhật state.
  const submitInProgress = useRef(false);

  const loadCourse = useCallback(async () => {
    if (!courseId) {
      setError("Thiếu mã khóa học.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetchCourseDetailAPI(courseId);

      if (
        Number(response.statusCode) < 200 ||
        Number(response.statusCode) >= 300 ||
        !response.data
      ) {
        throw new Error("Không tìm thấy khóa học.");
      }

      setCourse(response.data);
    } catch {
      setCourse(null);
      setError("Không thể tải thông tin khóa học.");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void loadCourse();
  }, [loadCourse]);

  const handleSubmit = async () => {
    if (!course || submitInProgress.current) return;

    if (course.status !== "Draft" && course.status !== "Rejected") {
      message.warning("Không thể gửi khóa học phê duyệt.");
      return;
    }

    submitInProgress.current = true;
    setSubmitting(true);

    try {
      const response = await submitCourseForApprovalAPI(course.id);

      // The Axios interceptor can resolve an HTTP error body.
      const statusCode = Number(response.statusCode);
      if (
        !Number.isInteger(statusCode) ||
        statusCode < 200 ||
        statusCode >= 300 ||
        response.data?.status !== "Submitted"
      ) {
        message.error(getSubmitErrorMessage(response));

        await loadCourse();
        return;
      }

      message.success("Đã gửi khóa học phê duyệt.");

      navigate(`/instructor/courses/${course.id}/submitted`, { replace: true });
    } catch (error: unknown) {
      message.error(getSubmitErrorMessage(error));

      await loadCourse();
    } finally {
      submitInProgress.current = false;
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <InstructorPage className="instructor-course-submit">
        <Skeleton active paragraph={{ rows: 6 }} />
      </InstructorPage>
    );
  }

  if (!course) {
    return (
      <InstructorPage className="instructor-course-submit">
        <PageHeader
          eyebrow="Khóa học / Phê duyệt"
          title="Không tìm thấy khóa học"
          back
          subtitle=""
        />
        <Alert type="error" showIcon message={error || "Không tìm thấy khóa học."} />
        <InstructorButton onClick={() => navigate("/instructor/courses")}>
          Quay lại khóa học của tôi
        </InstructorButton>
      </InstructorPage>
    );
  }

  const canSubmit = course.status === "Draft" || course.status === "Rejected";

  const informationComplete =
    Boolean(course.shortDescription?.trim()) &&
    Boolean(course.trainingObjectives?.trim()) &&
    course.learningOutcomes.some((outcome) => outcome.trim().length > 0);

  return (
    <InstructorPage className="instructor-course-submit">
      <PageHeader
        eyebrow="Khóa học / Phê duyệt"
        title="Kiểm tra và gửi khóa học phê duyệt"
        subtitle="Kiểm tra khóa học trước khi gửi phê duyệt."
        back
      />

      <div className="instructor-submit-grid">
        <SectionCard className="instructor-submit-main">
          <h2 className="instructor-submit-heading">
            {course.name} • {course.status}
          </h2>

          {course.status === "Rejected" && course.rejectionReason && (
            <Alert
              type="warning"
              showIcon
              message="Lý do từ chối trước đó"
              description={course.rejectionReason}
              style={{ marginBottom: 16 }}
            />
          )}

          {!canSubmit && (
            <Alert
              type="warning"
              showIcon
              message="Không thể gửi khóa học này phê duyệt."
              style={{ marginBottom: 16 }}
            />
          )}

          {!informationComplete && (
            <Alert
              type="warning"
              showIcon
              message="Thông tin khóa học chưa đầy đủ."
              description="Cần có mô tả ngắn, mục tiêu đào tạo và ít nhất một kết quả học tập mong đợi."
              style={{ marginBottom: 16 }}
            />
          )}

          <div className="instructor-submit-rows">
            <div className="instructor-submit-row">
              <div>
                <strong>Chi tiết khóa học</strong>
                <p>Kiểm tra mô tả, mục tiêu và kết quả học tập mong đợi.</p>
              </div>

              <button
                type="button"
                className="instructor-submit-review-link"
                onClick={() =>
                  navigate(`/instructor/courses/${course.id}/edit`)
                }
              >
                Kiểm tra
              </button>
            </div>

            <div className="instructor-submit-row">
              <div>
                <strong>Nội dung và bài đánh giá của khóa học</strong>
                <p>Kiểm tra chương, bài học, học liệu và câu hỏi trắc nghiệm.</p>
              </div>

              <button
                type="button"
                className="instructor-submit-review-link"
                onClick={() =>
                  navigate(`/instructor/courses/${course.id}/builder`)
                }
              >
                Kiểm tra
              </button>
            </div>
          </div>

          <div className="instructor-submit-warning">
            <strong>Thời lượng học dự kiến</strong>
            <p>
              {course.estimatedDurationMinutes === null
                ? "Chưa có thông tin thời lượng dự kiến."
                : `${course.estimatedDurationMinutes} phút dự kiến.`}
            </p>
            <p>Cảnh báo thời lượng không ngăn việc gửi phê duyệt.</p>
          </div>

          <div className="instructor-submit-actions">
            <InstructorButton
              disabled={submitting}
              onClick={() => navigate(`/instructor/courses/${course.id}`)}
            >
              Hủy
            </InstructorButton>

            <InstructorButton
              type="primary"
              loading={submitting}
              disabled={!canSubmit || !informationComplete}
              onClick={() => void handleSubmit()}
            >
              {course.status === "Rejected"
                ? "Gửi duyệt lại khóa học"
                : "Gửi khóa học phê duyệt"}
            </InstructorButton>
          </div>
        </SectionCard>

        <SectionCard title="Quy trình phê duyệt" className="instructor-submit-side">
          <p>Bản nháp hoặc bị từ chối → Chờ phê duyệt</p>
          <p>Quản lý đào tạo thẩm định và đưa ra quyết định.</p>
          <p>Đã gửi phê duyệt không có nghĩa là đã phát hành.</p>
        </SectionCard>
      </div>
    </InstructorPage>
  );
};

export default CourseSubmit;
