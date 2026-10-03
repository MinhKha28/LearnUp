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
  const base = `/instructor/courses/${course.id}/builder`;

  return (
    <aside className="builder-nav">
      <div className="builder-nav-header">
        <span className="builder-nav-eyebrow">STRUCTURE</span>
      </div>

      <div className="builder-nav-shortcuts">
        <button
          type="button"
          className={`builder-nav-link${pathname === base ? " active" : ""}`}
          onClick={() => navigate(base)}
        >
          View Course Structure
        </button>
      </div>

      {structure.structureLocked && structure.lockReason && (
        <p className="builder-nav-hint">
          <LockOutlined /> {structure.lockReason}
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
                {lesson.required && <small>Required</small>}
              </button>
            ))}

            {!structure.structureLocked && (
              <button
                type="button"
                className="builder-nav-add-lesson"
                onClick={() =>
                  navigate(`${base}/modules/${module.id}/lessons/new`)
                }
              >
                + Add Lesson
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
              <strong>Course Assessments</strong>
            </div>
            <button
              type="button"
              className={`builder-nav-lesson${pathname.startsWith(`${base}/quizzes`) ? " active" : ""}`}
              onClick={() => navigate(`${base}/quizzes`)}
            >
              <span>Quizzes</span>
            </button>
            {assignments.map((assignment) => (
              <button
                key={assignment.id}
                type="button"
                className={`builder-nav-lesson${pathname.startsWith(`${base}/assignments/${assignment.id}`) ? " active" : ""}`}
                onClick={() => navigate(`${base}/assignments/${assignment.id}`, { state: { from: pathname } })}
              >
                <span>{assignment.title}</span>
                {assignment.disabled && <small>Disabled</small>}
              </button>
            ))}
            <button
              type="button"
              className="builder-nav-add-lesson"
              onClick={() => navigate(`${base}/assignments/new`, { state: { from: pathname } })}
            >
              + Add Assignment
            </button>
          </div>
        )}
      </div>

      {!structure.structureLocked && (
        <button
          type="button"
          className="builder-nav-add"
          onClick={() => navigate(`${base}/modules/new`)}
        >
          + Add Module
        </button>
      )}

      <p className="builder-nav-legend">Course → Module → Lesson</p>
    </aside>
  );
};
