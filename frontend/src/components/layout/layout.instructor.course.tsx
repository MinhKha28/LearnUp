import { Alert, Spin, message } from "antd";
import { useCallback, useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";

import { CourseBuilderNav } from "@/components/instructor/course.nav";
import {
  InstructorButton,
  InstructorPage,
  PageHeader,
} from "@/components/instructor/instructor.ui";
import { fetchAssignmentsAPI } from "@/services/assessment.service";
import { fetchCourseStructureAPI } from "@/services/course.service";
import type { IAssignmentSummary } from "@/types/assessment.types";
import type { ICourseStructure } from "@/types/course.types";

import { courseStatusLabel } from "@/utils/course.status.labels";
import { isBuilderMutationPath } from "@/utils/submitted.course.builder";
import "./layout.instructor.course.scss";

export interface ICourseBuilderOutletContext {
  structure: ICourseStructure;
  refetchStructure: () => Promise<void>;
  /** Assignments from Assessment Service, null when that service cannot be reached. */
  assignments: IAssignmentSummary[] | null;
}

const LayoutInstructorCourse = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [assignments, setAssignments] = useState<IAssignmentSummary[] | null>(null);
  const [structure, setStructure] = useState<ICourseStructure | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadStructure = useCallback(async () => {
    if (!courseId) return;

    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetchCourseStructureAPI(courseId);

      if (!response.data) {
        setStructure(null);
        setErrorMessage("Không tải được cấu trúc Khóa học.");
        return;
      }

      setStructure(response.data);
    } catch (error) {
      console.error("Fetch Course structure error:", error);
      setStructure(null);
      setErrorMessage("Không tải được cấu trúc Khóa học.");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void loadStructure();
  }, [loadStructure]);

  // Refetched on every route change so a created/deleted Assignment shows in the outline; failures stay silent.
  useEffect(() => {
    if (!courseId) return;
    void (async () => {
      const res = await fetchAssignmentsAPI(courseId);
      setAssignments(res.data?.items ?? null);
    })();
  }, [courseId, pathname]);

  if (loading) {
    return (
      <div className="builder-loading">
        <Spin size="large" />
      </div>
    );
  }

  if (errorMessage || !structure) {
    return (
      <InstructorPage>
        <PageHeader
          eyebrow="Khóa học của tôi / Trình soạn Khóa học"
          title="Cấu trúc Khóa học"
          subtitle=""
          back
        />

        <Alert
          type="error"
          showIcon
          message={errorMessage || "Không tìm thấy Khóa học."}
        />

        <div style={{ marginTop: 16 }}>
          <InstructorButton onClick={() => navigate("/instructor/courses")}>
            Quay lại khóa học của tôi
          </InstructorButton>
        </div>
      </InstructorPage>
    );
  }

  const course = structure.course;
  const isSubmitted = course.status === "Submitted";
  const editingRouteBlocked = isSubmitted && isBuilderMutationPath(pathname);

  return (
    <div className="builder-layout">
      {isSubmitted && (
        <Alert
          type="warning"
          showIcon
          message="Khóa học đang chờ phê duyệt"
          description="Bạn chỉ có thể xem nội dung. Hãy thu hồi khóa học trước khi chỉnh sửa."
        />
      )}
      <header className="builder-topbar">
        <div className="builder-topbar-left">
          <button
            type="button"
            className="builder-topbar-back"
            onClick={() => navigate("/instructor/courses")}
          >
            ← Quay lại
          </button>

          <div className="builder-topbar-course">
            <Link
              className="builder-topbar-title"
              to={`/instructor/courses/${course.id}/builder`}
            >
              {course.name}
            </Link>

            <div className="builder-topbar-meta">
              <span>{courseStatusLabel[course.status]}</span>
              <span className="builder-topbar-meta-dot">•</span>
              <span>Vừa lưu gần đây</span>
            </div>
          </div>
        </div>

        <div className="builder-topbar-right">
          <button
            type="button"
            className="builder-topbar-action"
            onClick={() => message.info("Tính năng xem trước chưa được hỗ trợ.")}
          >
            Xem trước
          </button>

          <button
            type="button"
            className="builder-topbar-action"
            disabled={isSubmitted}
            onClick={() => message.success("Đã lưu bản nháp.")}
          >
            Lưu bản nháp
          </button>

          <button
            type="button"
            className="builder-topbar-publish"
            disabled={isSubmitted}
            onClick={() => navigate(`/instructor/courses/${course.id}/submit`)}
          >
            Gửi Khóa học để phê duyệt
          </button>
        </div>
      </header>

      <div className="builder-body">
        <CourseBuilderNav structure={structure} assignments={assignments} />

        <main className="builder-main">
          {editingRouteBlocked ? (
            <div className="builder-banner" role="alert">
              <strong>Không thể chỉnh sửa khóa học đang chờ phê duyệt</strong>
              <p>Thu hồi khóa học về bản nháp trước khi chỉnh sửa.</p>
              <InstructorButton onClick={() => navigate(`/instructor/courses/${course.id}/builder`)}>
                Quay lại cấu trúc khóa học
              </InstructorButton>
            </div>
          ) : <Outlet
            context={{
              structure,
              refetchStructure: loadStructure,
              assignments,
            }}
          />}
        </main>
      </div>
    </div>
  );
};

export default LayoutInstructorCourse;
