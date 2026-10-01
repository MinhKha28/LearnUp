import { LockOutlined, PlusOutlined } from "@ant-design/icons";
import { Empty } from "antd";
import { useNavigate, useOutletContext } from "react-router-dom";

import type { ICourseBuilderOutletContext } from "@/components/layout/layout.instructor.course";
import { InstructorButton } from "@/components/instructor/instructor.ui";

import "./course.builder.scss";

const CourseBuilder = () => {
  const navigate = useNavigate();
  const { structure, assignments } = useOutletContext<ICourseBuilderOutletContext>();

  const course = structure.course;
  const base = `/instructor/courses/${course.id}/builder`;

  return (
    <div className="builder-outline-page">
      <div className="builder-editor-header">
        <div>
          <span className="builder-editor-eyebrow">COURSE BUILDER</span>
          <h1>Course Structure</h1>
          <p>Organize this Course into Modules and Lessons.</p>
        </div>
      </div>

      {structure.structureLocked && structure.lockReason && (
        <div className="builder-banner">
          <strong>
            <LockOutlined /> Structure locked
          </strong>
          <p>{structure.lockReason}</p>
        </div>
      )}

      {structure.modules.length === 0 ? (
        <div className="builder-empty">
          <Empty description="No Modules yet" />

          {!structure.structureLocked && (
            <InstructorButton
              type="primary"
              onClick={() => navigate(`${base}/modules/new`)}
            >
              <PlusOutlined /> Add first Module
            </InstructorButton>
          )}
        </div>
      ) : (
        <div className="builder-structure-list">
          {structure.modules.map((module, index) => (
            <div className="builder-structure-module" key={module.id}>
              <div className="builder-structure-module-header">
                <div className="builder-module-title-row">
                  <span className="builder-module-number">{index + 1}</span>

                  <div>
                    <h2>{module.title}</h2>
                    <p>
                      {module.required ? "Required" : "Optional"} •{" "}
                      {module.lessons.length} Lesson
                      {module.lessons.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>

                {!structure.structureLocked && (
                  <InstructorButton
                    onClick={() =>
                      navigate(`${base}/modules/${module.id}/lessons/new`)
                    }
                  >
                    + Add Lesson
                  </InstructorButton>
                )}
              </div>

              {module.lessons.length > 0 ? (
                <div className="builder-structure-lessons">
                  {module.lessons.map((lesson, lessonIndex) => (
                    <button
                      key={lesson.id}
                      type="button"
                      onClick={() => navigate(`${base}/lessons/${lesson.id}`)}
                    >
                      <span>
                        {lessonIndex + 1}. {lesson.title}
                      </span>

                      {lesson.required && <small>Required</small>}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="builder-structure-empty-lessons">
                  No Lessons yet.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {assignments && (
        <div className="builder-structure-list">
          <div className="builder-structure-module">
            <div className="builder-structure-module-header">
              <h2>Assignments</h2>
              <InstructorButton onClick={() => navigate(`${base}/assignments/new`)}>
                + Add Assignment
              </InstructorButton>
            </div>
            <div className="builder-structure-lessons">
              {assignments.length === 0 && (
                <p className="builder-structure-empty-lessons">No Assignments yet.</p>
              )}
              {assignments.map((assignment, index) => (
                <button
                  key={assignment.id}
                  type="button"
                  onClick={() => navigate(`${base}/assignments/${assignment.id}`)}
                >
                  <span>
                    {index + 1}. {assignment.title}
                  </span>
                  {assignment.disabled && <small>Disabled</small>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseBuilder;
