import { LockOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";

import type { ICourseStructure } from "@/types/course.types";

import "./course.nav.scss";

interface ICourseBuilderNavProps {
  structure: ICourseStructure;
}

export const CourseBuilderNav = ({ structure }: ICourseBuilderNavProps) => {
  const navigate = useNavigate();
  const course = structure.course;
  const base = `/instructor/courses/${course.id}/builder`;

  return (
    <aside className="builder-nav">
      <div className="builder-nav-header">
        <span className="builder-nav-eyebrow">STRUCTURE</span>
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
