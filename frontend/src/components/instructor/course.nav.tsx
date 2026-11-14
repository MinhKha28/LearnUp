import { FileTextOutlined, LockOutlined } from "@ant-design/icons";
import { useLocation, useNavigate } from "react-router-dom";

import type { IAssignmentSummary } from "@/types/assessment.types";
import type { ICourseStructure } from "@/types/course.types";

import "./course.nav.scss";

interface ICourseBuilderNavProps {
  structure: ICourseStructure;
  /** BR-154: shown after the Modules, in position order. */
  assignments?: IAssignmentSummary[] | null;
}

export const CourseBuilderNav = ({ structure, assignments }: ICourseBuilderNavProps) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const course = structure.course;
  const isSubmitted = course.status === "Submitted";
  const canEditStructure = !structure.structureLocked && !isSubmitted;
  const base = `/instructor/courses/${course.id}/builder`;

  return (
    <aside className="builder-nav">
      <div className="builder-nav-header">
        <span className="builder-nav-eyebrow">Cấu trúc</span>
      </div>

      <div className="builder-nav-shortcuts">
        <button
          type="button"
          className={`builder-nav-link${pathname === base ? " active" : ""}`}
          onClick={() => navigate(base)}
        >
          Xem cấu trúc Khóa học
        </button>
      </div>

      {structure.structureLocked && (
        <p className="builder-nav-hint">
          <LockOutlined />{" "}
          {course.status === "Submitted"
            ? "Khóa học đang chờ phê duyệt. Hãy rút yêu cầu phê duyệt để chỉnh sửa."
            : "Cấu trúc Khóa học đã khóa vì đã có Học viên đăng ký."}
        </p>
      )}

      <div className="builder-nav-tree">
        {structure.modules.map((module, moduleIndex) => (
          <div className="builder-nav-module" key={module.id}>
            <div className="builder-nav-module-heading">
              <span className="builder-nav-module-index">
                {moduleIndex + 1}
              </span>
              <strong>{module.title}</strong>
            </div>

            {module.lessons.map((lesson) => (
              <button
                key={lesson.id}
                type="button"
                className="builder-nav-lesson"
                onClick={() => navigate(`${base}/lessons/${lesson.id}`)}
              >
                <span>{lesson.title}</span>
                {lesson.required && <small>Bắt buộc</small>}
              </button>
            ))}

            {canEditStructure && (
              <button
                type="button"
                className="builder-nav-add-lesson"
                onClick={() =>
                  navigate(`${base}/modules/${module.id}/lessons/new`)
                }
              >
                + Thêm Bài học
              </button>
            )}
          </div>
        ))}
        {assignments && (
          <div className="builder-nav-module">
            <div className="builder-nav-module-heading">
              <span className="builder-nav-module-index">
                <FileTextOutlined />
              </span>
              <strong>Bài đánh giá của Khóa học</strong>
            </div>
            <button
              type="button"
              className={`builder-nav-lesson${pathname.startsWith(`${base}/quizzes`) ? " active" : ""}`}
              onClick={() => navigate(`${base}/quizzes`)}
            >
              <span>Bài trắc nghiệm</span>
            </button>
            {assignments.map((assignment) => (
              <button
                key={assignment.id}
                type="button"
                className={`builder-nav-lesson${pathname.startsWith(`${base}/assignments/${assignment.id}`) ? " active" : ""}`}
                onClick={() => navigate(`${base}/assignments/${assignment.id}`, { state: { from: pathname } })}
              >
                <span>{assignment.title}</span>
                {assignment.disabled && <small>Đã vô hiệu hóa</small>}
              </button>
            ))}
            {!isSubmitted && !course.locked && <button
              type="button"
              className="builder-nav-add-lesson"
              onClick={() => navigate(`${base}/assignments/new`, { state: { from: pathname } })}
            >
              + Thêm Bài tập
            </button>}
          </div>
        )}
      </div>

      {!structure.structureLocked && (
        <button
          type="button"
          className="builder-nav-add"
          onClick={() => navigate(`${base}/modules/new`)}
        >
          + Thêm Chương
        </button>
      )}

      <p className="builder-nav-legend">Khóa học → Chương → Bài học</p>
    </aside>
  );
};
