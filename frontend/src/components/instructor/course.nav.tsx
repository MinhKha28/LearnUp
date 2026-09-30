import { FileTextOutlined, PlayCircleOutlined } from "@ant-design/icons";
import { Link, useNavigate } from "react-router-dom";
import type { ICourse } from "@/components/instructor/instructor.data";
import type { ICourseStructure } from "@/components/instructor/instructor.data";
import "./course.nav.scss";

export const CourseBuilderNav = ({
  course,
  structure,
  activeModuleId,
  activeLessonId,
  activeResourceId,
}: {
  course: ICourse;
  structure?: ICourseStructure;
  activeModuleId?: string;
  activeLessonId?: string;
  activeResourceId?: string;
}) => {
  const navigate = useNavigate();
  const base = `/instructor/courses/${course.id}/builder`;

  return (
    <aside className="builder-nav">
      <span className="builder-nav-eyebrow">Curriculum Tree</span>
      <h3>{course.title}</h3>
      <span className={`builder-nav-status builder-nav-status-${course.locked ? "locked" : "open"}`}>
        {course.locked ? "Locked" : "Draft"}
      </span>
      {course.locked && <p className="builder-nav-hint">Structure locked after first Enrollment.</p>}
      <Link className="builder-nav-outline-link" to={base}>
        ← Course Outline
      </Link>
      <Link className="builder-nav-add" to={`${base}/modules/new`} aria-disabled={course.locked}>
        + Add Module
      </Link>
      <div className="builder-nav-tree">
        {structure?.modules.map((module) => (
          <div className="builder-nav-module" key={module.id}>
            <span
              className={`builder-nav-module-title${module.id === activeModuleId && !activeLessonId ? " active" : ""}`}
            >
              {module.title.toUpperCase()}
            </span>
            {module.lessons.map((lesson) => (
              <div key={lesson.id}>
                <button
                  type="button"
                  className={`builder-nav-lesson${lesson.id === activeLessonId && !activeResourceId ? " active" : ""}`}
                  onClick={() => navigate(`${base}/lessons/${lesson.id}`)}
                >
                  {lesson.title}
                </button>
                {lesson.resources.map((resource) => (
                  <button
                    type="button"
                    key={resource.id}
                    className={`builder-nav-resource${resource.id === activeResourceId ? " active" : ""}`}
                    onClick={() => navigate(`${base}/lessons/${lesson.id}/materials`)}
                  >
                    {resource.type === "video" ? <PlayCircleOutlined /> : <FileTextOutlined />}
                    {resource.title}
                  </button>
                ))}
              </div>
            ))}
            {structure?.quizzes
              .filter((quiz) => quiz.location === "module" && quiz.moduleId === module.id)
              .map((quiz) => (
                <button
                  type="button"
                  key={quiz.id}
                  className="builder-nav-quiz builder-nav-quiz-link"
                  onClick={() => navigate(`${base}/quizzes/${quiz.id}`)}
                >
                  {quiz.title}
                </button>
              ))}
          </div>
        ))}
        {structure && structure.modules.length > 0 && (
          <div className="builder-nav-module">
            <span className="builder-nav-module-title">COURSE ASSESSMENTS</span>
            {structure.quizzes
              .filter((quiz) => quiz.location === "course")
              .map((quiz) => (
                <button
                  type="button"
                  key={quiz.id}
                  className="builder-nav-quiz builder-nav-quiz-link"
                  onClick={() => navigate(`${base}/quizzes/${quiz.id}`)}
                >
                  {quiz.title}
                </button>
              ))}
            {structure.assignments.map((assignment) => (
              <button
                type="button"
                key={assignment.id}
                className="builder-nav-quiz builder-nav-quiz-link"
                onClick={() => navigate(`${base}/assignments/${assignment.id}`)}
              >
                {assignment.title}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="builder-nav-legend">
        Course → Module → Lesson
        <br />
        Quiz at Module or Course level
        <br />
        Assignment at Course level
      </p>
    </aside>
  );
};
