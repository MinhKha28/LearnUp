import { message } from "antd";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  findCourseStructure,
  findInstructorCourse,
  moveBuilderLesson,
  moveBuilderModule,
  type IBuilderLesson,
  type IBuilderModule,
} from "@/components/instructor/instructor.data";
import { InfoPanel, InstructorButton, InstructorPage } from "@/components/instructor/instructor.ui";
import "./course.builder.scss";

type Row =
  | { kind: "module"; module: IBuilderModule; index: number; total: number }
  | { kind: "lesson"; module: IBuilderModule; lesson: IBuilderLesson; index: number; total: number };

const CourseBuilderStructureEdit = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const course = findInstructorCourse(courseId);
  const structure = findCourseStructure(courseId);
  const [, forceRender] = useState(0);

  if (!course || !structure) return null;

  const base = `/instructor/courses/${course.id}/builder`;
  const locked = course.locked;

  const rows: Row[] = [];
  structure.modules.forEach((module, moduleIndex) => {
    rows.push({ kind: "module", module, index: moduleIndex, total: structure.modules.length });
    module.lessons.forEach((lesson, lessonIndex) => {
      rows.push({
        kind: "lesson",
        module,
        lesson,
        index: lessonIndex,
        total: module.lessons.length,
      });
    });
  });

  const rerender = () => forceRender((value) => value + 1);

  const renameModule = (module: IBuilderModule) => {
    const title = window.prompt("Module title", module.title);
    if (title && title.trim()) {
      module.title = title.trim();
      rerender();
    }
  };

  const renameLesson = (lesson: IBuilderLesson) => {
    const title = window.prompt("Lesson title", lesson.title);
    if (title && title.trim()) {
      lesson.title = title.trim();
      rerender();
    }
  };

  const toggleModuleRequirement = (module: IBuilderModule) => {
    if (locked) return;
    module.required = !module.required;
    rerender();
  };

  const toggleLessonRequirement = (lesson: IBuilderLesson) => {
    if (locked) return;
    lesson.required = !lesson.required;
    rerender();
  };

  const handleSave = () => {
    message.success("Course structure saved.");
    navigate(base);
  };

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Course Builder / Edit Course Structure</span>
      <div className="builder-hero">
        <h1>Edit Course Structure</h1>
      </div>
      <div className="builder-grid">
        <div className="builder-update-card">
          <h2>Modules and Lessons</h2>
          <div className="builder-structure-list">
            {rows.map((row) =>
              row.kind === "module" ? (
                <div className="builder-structure-row" key={row.module.id}>
                  <div className="builder-structure-row-main">
                    <strong>{row.module.title}</strong>
                    <small>Drag to reorder · Edit title or requirement</small>
                  </div>
                  <div className="builder-structure-row-actions">
                    <button
                      type="button"
                      className="builder-reorder-btn"
                      disabled={locked || row.index === 0}
                      onClick={() => {
                        moveBuilderModule(structure, row.module.id, -1);
                        rerender();
                      }}
                      aria-label="Move module up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="builder-reorder-btn"
                      disabled={locked || row.index === row.total - 1}
                      onClick={() => {
                        moveBuilderModule(structure, row.module.id, 1);
                        rerender();
                      }}
                      aria-label="Move module down"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="builder-table-link"
                      onClick={() => renameModule(row.module)}
                    >
                      Rename
                    </button>
                    <InstructorButton
                      size="small"
                      disabled={locked}
                      onClick={() => toggleModuleRequirement(row.module)}
                    >
                      {row.module.required ? "Required" : "Optional"}
                    </InstructorButton>
                    <button
                      type="button"
                      className="builder-table-link builder-table-link-danger"
                      onClick={() =>
                        navigate(`${base}/modules/${row.module.id}/delete`)
                      }
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="builder-structure-row builder-structure-row-indent"
                  key={row.lesson.id}
                >
                  <div className="builder-structure-row-main">
                    <strong>{row.lesson.title}</strong>
                    <small>Drag to reorder · Edit title or requirement</small>
                  </div>
                  <div className="builder-structure-row-actions">
                    <button
                      type="button"
                      className="builder-reorder-btn"
                      disabled={locked || row.index === 0}
                      onClick={() => {
                        moveBuilderLesson(structure, row.module.id, row.lesson.id, -1);
                        rerender();
                      }}
                      aria-label="Move lesson up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="builder-reorder-btn"
                      disabled={locked || row.index === row.total - 1}
                      onClick={() => {
                        moveBuilderLesson(structure, row.module.id, row.lesson.id, 1);
                        rerender();
                      }}
                      aria-label="Move lesson down"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="builder-table-link"
                      onClick={() => renameLesson(row.lesson)}
                    >
                      Rename
                    </button>
                    <InstructorButton
                      size="small"
                      disabled={locked}
                      onClick={() => toggleLessonRequirement(row.lesson)}
                    >
                      {row.lesson.required ? "Required" : "Optional"}
                    </InstructorButton>
                    <button
                      type="button"
                      className="builder-table-link builder-table-link-danger"
                      onClick={() =>
                        navigate(`${base}/lessons/${row.lesson.id}/delete`)
                      }
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ),
            )}
          </div>
          <div className="builder-actions">
            <InstructorButton onClick={() => navigate(base)}>Cancel</InstructorButton>
            <InstructorButton type="primary" onClick={handleSave}>
              Save structure
            </InstructorButton>
          </div>
        </div>
        <div className="builder-side">
          <InfoPanel title="Lock protection">
            Titles always remain editable; order and Required flags lock after first Enrollment.
          </InfoPanel>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderStructureEdit;
