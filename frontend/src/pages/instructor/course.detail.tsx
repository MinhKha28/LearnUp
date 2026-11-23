import { canOpenPage } from "@/utils/preview.pages";
import { Alert, App, Modal, Skeleton } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  InstructorButton,
  InstructorPage,
  PageHeader,
  SectionCard,
  StatusTag,
} from "@/components/instructor/instructor.ui";
import {
  fetchCourseDetailAPI,
  softDeleteCourseAPI,
} from "@/services/course.service";
import type { CourseStatus, ICourseDetail } from "@/types/course.types";

import { courseStatusLabel } from "@/utils/course.status.labels";
import "./course.detail.scss";
import {
  courseTrashErrorMessage,
  getCourseApiErrorCode,
} from "@/utils/course-trash";


const getCourseStatusTone = (
  status: CourseStatus,
): "neutral" | "success" | "warning" | "error" | "info" => {
  switch (status) {
    case "Published":
      return "success";
    case "Submitted":
      return "info";
    case "Rejected":
    case "Disabled":
      return "error";
    case "Archived":
      return "warning";
    default:
      return "neutral";
  }
};

const formatEstimatedDuration = (minutes: number | null) => {
  if (minutes === null) return "Chưa có thông tin";
  if (minutes < 60) return `${minutes} phút`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0
    ? `${hours} giờ ${remainingMinutes} phút`
    : `${hours} giờ`;
};

const CourseDetail = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();

  const [deleting, setDeleting] = useState(false);
  const [course, setCourse] = useState<ICourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchCourse = useCallback(async () => {
    if (!courseId) {
      setLoading(false);
      setErrorMessage("Thiếu mã khóa học.");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetchCourseDetailAPI(courseId);

      if (!response.data) {
        setCourse(null);
        setErrorMessage(response.message || "Không thể tải chi tiết khóa học.");
        return;
      }

      setCourse(response.data);
    } catch (error) {
      console.error("Fetch Course detail error:", error);
      setCourse(null);
      setErrorMessage("Không thể tải chi tiết khóa học.");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void fetchCourse();
  }, [fetchCourse]);

  if (loading) {
    return (
      <InstructorPage className="instructor-course-detail">
        <Skeleton active />
      </InstructorPage>
    );
  }

  if (!course) {
    return (
      <InstructorPage className="instructor-course-detail">
        <PageHeader
          eyebrow="Khóa học của tôi"
          title="Không tìm thấy khóa học"
          subtitle="Khóa học không tồn tại hoặc bạn không có quyền truy cập."
          back
        />

        <Alert
          type="error"
          showIcon
          message={errorMessage || "Không tìm thấy khóa học."}
        />

        <InstructorButton onClick={() => navigate("/instructor/courses")}>
          Quay lại khóa học của tôi
        </InstructorButton>
      </InstructorPage>
    );
  }

  const handleSoftDelete = () => {
    if (!course || deleting) return;

    Modal.confirm({
      title: "Chuyển khóa học vào thùng rác?",
      content: (
        <>
          <p>
            Khóa học "{course.name}" sẽ được giữ trong thùng rác 7 ngày
            trước khi bị xóa vĩnh viễn.
          </p>
          <p>
            Khóa học và các tệp vẫn được tính vào giới hạn số khóa học
            và dung lượng lưu trữ trong thời gian này.
          </p>
        </>
      ),
      okText: "Chuyển vào thùng rác",
      cancelText: "Hủy",
      okButtonProps: { danger: true },

      onOk: async () => {
        setDeleting(true);

        try {
          const response = await softDeleteCourseAPI(course.id);

          if (!response.data) {
            const code = getCourseApiErrorCode(response);

            throw new Error(courseTrashErrorMessage(code, "delete"));
          }

          message.success("Đã chuyển khóa học vào thùng rác.");
          navigate("/instructor/courses");
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : courseTrashErrorMessage(getCourseApiErrorCode(error), "delete");

          message.error(errorMessage);
        } finally {
          setDeleting(false);
        }
      },
    });
  };

  return (
    <InstructorPage className="instructor-course-detail">
      <PageHeader
        eyebrow="Khóa học của tôi / Chi tiết"
        title={course.name}
        subtitle={`Phiên bản ${course.versionNumber} • ${
          course.courseType === "Public" ? "Public" : "Private"
        }`}
        back
        actions={
          <InstructorButton
            onClick={() => navigate(`/instructor/courses/${course.id}/builder`)}
          >
            Mở trình xây dựng
          </InstructorButton>
        }
      />

      {course.coverUrl && (
        <div className="instructor-course-detail-cover">
          <img src={course.coverUrl} alt={course.name} />
        </div>
      )}

      <div className="instructor-course-detail-grid">
        <SectionCard className="instructor-course-detail-main">
          <div className="instructor-course-detail-block">
            <h2>Mô tả ngắn</h2>
            <p>
              {course.shortDescription ||
                "Chưa có mô tả ngắn cho khóa học."}
            </p>
          </div>

          <div className="instructor-course-detail-block">
            <h2>Mục tiêu đào tạo</h2>
            <p>
              {course.trainingObjectives ||
                "Chưa có mục tiêu đào tạo cho khóa học."}
            </p>
          </div>

          <div className="instructor-course-detail-block">
            <h2>Kết quả học tập mong đợi</h2>

            {course.learningOutcomes.length > 0 ? (
              <ul className="instructor-course-outcomes">
                {course.learningOutcomes.map((outcome, index) => (
                  <li key={`${index}-${outcome}`}>{outcome}</li>
                ))}
              </ul>
            ) : (
              <p>Chưa có kết quả học tập mong đợi.</p>
            )}
          </div>

          <div className="instructor-course-detail-block instructor-course-detail-block-last">
            <h2>Thông tin khóa học</h2>

            <div className="instructor-course-info-table">
              <div className="instructor-course-info-row">
                <strong>Thời gian hoàn thành dự kiến</strong>
                <span>{course.expectedCompletionDays} days</span>
              </div>

              <div className="instructor-course-info-row">
                <strong>Thời lượng học dự kiến</strong>
                <span>
                  {formatEstimatedDuration(course.estimatedDurationMinutes)}
                </span>
              </div>

              <div className="instructor-course-info-row">
                <strong>Loại khóa học</strong>
                <span>
                  {course.courseType === "Public" ? "Public" : "Private"}
                </span>
              </div>

              <div className="instructor-course-info-row">
                <strong>Trạng thái phê duyệt</strong>
                <StatusTag tone={getCourseStatusTone(course.status)}>
                  {courseStatusLabel[course.status]}
                </StatusTag>
              </div>

              <div className="instructor-course-info-row">
                <strong>Trạng thái cấu trúc</strong>
                <span>{course.locked ? "Đã khóa" : "Chưa khóa"}</span>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Thao tác" className="instructor-course-actions-card">
          {(course.status === "Draft" || course.status === "Rejected") && (
            <InstructorButton
              block
              onClick={() => navigate(`/instructor/courses/${course.id}/edit`)}
            >
              Chỉnh sửa chi tiết khóa học
            </InstructorButton>
          )}

          <InstructorButton
            block
            onClick={() => navigate(`/instructor/courses/${course.id}/builder`)}
          >
            Mở trình xây dựng
          </InstructorButton>

          {(course.status === "Draft" || course.status === "Rejected") && (
            <InstructorButton
              block
              type="primary"
              onClick={() =>
                navigate(`/instructor/courses/${course.id}/submit`)
              }
            >
              Gửi phê duyệt
            </InstructorButton>
          )}

          {course.status === "Submitted" && (
            <InstructorButton
              block
              onClick={() =>
                navigate(`/instructor/courses/${course.id}/withdraw`)
              }
            >
              Thu hồi khóa học đã gửi
            </InstructorButton>
          )}

          {course.status === "Published" && canOpenPage(`/instructor/courses/${course.id}/versions`) && (
            <InstructorButton
              block
              onClick={() => navigate(`/instructor/courses/${course.id}/versions`)}
            >
              Xem chuỗi phiên bản
            </InstructorButton>
          )}

          {(course.status === "Draft" || course.status === "Rejected") &&
            !course.locked && (
              <InstructorButton
                block
                danger
                loading={deleting}
                onClick={handleSoftDelete}
              >
                Chuyển vào thùng rác
              </InstructorButton>
            )}
        </SectionCard>
      </div>
    </InstructorPage>
  );
};

export default CourseDetail;
