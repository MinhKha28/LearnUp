import { CheckOutlined, PlayCircleFilled } from "@ant-design/icons";
import { Link, useNavigate } from "react-router-dom";
import type { ICourseDetail } from "@/components/learner/learner.data";
import { countRemainingRequired, findCourseEvaluation } from "@/components/learner/learner.data";
import { ProgressLine, StatusTag } from "@/components/learner/learner.ui";
import "./course.nav.scss";

const resourceIcon = (status: string, type: string) => {
  if (status === "complete") return <CheckOutlined />;
  if (type === "video") return <PlayCircleFilled />;
  return <span className="course-nav-dot" />;
};

export const CourseNav = ({
  course,
  activeLessonId,
  activeResourceId,
  activeSection,
  activeQuizId,
  activeAssignmentId,
}: {
  course: ICourseDetail;
  activeLessonId?: string;
  activeResourceId?: string;
  activeSection?: "progress" | "assessments" | "evaluation";
  activeQuizId?: string;
  activeAssignmentId?: string;
}) => {
  const navigate = useNavigate();
  const remaining = countRemainingRequired(course);
  const evaluation = findCourseEvaluation(course.id);

  return (
    <aside className="course-nav">
      <Link className="course-nav-brand" to="/learner" aria-label="LearnUP Learner home">
        <img src="/logo/learnup-logo-dark.png" alt="LearnUP" />
      </Link>
      <Link className="course-nav-back" to="/learner/courses">
        ← Back to My Courses
      </Link>
      <h3>{course.title}</h3>
      <span className="course-nav-version">{course.version}</span>
      <StatusTag tone={course.audience === "required" ? "warning" : "info"}>
        {course.audience === "required" ? "Required" : "Optional"}
      </StatusTag>
      <div className="course-nav-progress">
        <ProgressLine value={course.progress} tone="amber" />
        <span>{course.progress}% complete</span>
      </div>
      <hr />
      <span className="course-nav-eyebrow">Course content</span>
      {course.modules.map((module) => (
        <div className="course-nav-module" key={module.id}>
          <span className="course-nav-module-title">{module.title}</span>
          {module.lessons.map((lesson) => (
            <div key={lesson.id}>
              <button
                type="button"
                className={`course-nav-lesson${lesson.id === activeLessonId && !activeSection ? " active" : ""}`}
                onClick={() => navigate(`/learner/courses/${course.id}/lessons/${lesson.id}`)}
              >
                {lesson.title}
              </button>
              {lesson.resources
                .filter((resource) => resource.required)
                .map((resource) => (
                  <button
                    type="button"
                    key={resource.id}
                    className={`course-nav-resource course-nav-resource-${resource.status}${
                      resource.id === activeResourceId && !activeSection ? " active" : ""
                    }`}
                    onClick={() =>
                      navigate(
                        `/learner/courses/${course.id}/lessons/${lesson.id}/resources/${resource.id}`,
                      )
                    }
                  >
                    {resourceIcon(resource.status, resource.type)}
                    {resource.title}
                  </button>
                ))}
            </div>
          ))}
          {module.quizTitle && (
            <button
              type="button"
              className={`course-nav-quiz${module.quizId === activeQuizId && !activeSection ? " active" : ""}`}
              onClick={() =>
                module.quizId &&
                navigate(`/learner/courses/${course.id}/quizzes/${module.quizId}`)
              }
            >
              {module.quizTitle}
            </button>
          )}
        </div>
      ))}
      {course.assessments.length > 0 && (
        <>
          <hr />
          <button
            type="button"
            className={`course-nav-lesson course-nav-eyebrow-link${activeSection === "assessments" ? " active" : ""}`}
            onClick={() => navigate(`/learner/courses/${course.id}/assessments`)}
          >
            Course assessments
          </button>
          {course.assessments.map((assessment) => (
            <button
              type="button"
              className={`course-nav-quiz${assessment.id === activeAssignmentId ? " active" : ""}`}
              key={assessment.id}
              onClick={() =>
                navigate(`/learner/courses/${course.id}/assignments/${assessment.id}`)
              }
            >
              {assessment.title}
            </button>
          ))}
        </>
      )}
      <hr />
      <button
        type="button"
        className={`course-nav-lesson course-nav-progress-link${activeSection === "progress" ? " active" : ""}`}
        onClick={() => navigate(`/learner/courses/${course.id}/progress`)}
      >
        Course progress
      </button>
      {evaluation && (
        <button
          type="button"
          className={`course-nav-lesson course-nav-eyebrow-link${activeSection === "evaluation" ? " active" : ""}`}
          onClick={() => navigate(`/learner/courses/${course.id}/evaluation`)}
        >
          Course Evaluation
        </button>
      )}
      <hr />
      <span className="course-nav-footer">Required resources • {remaining} remaining</span>
      {course.audience === "optional" && (
        <button
          type="button"
          className="course-nav-withdraw"
          onClick={() => navigate(`/learner/courses/${course.id}/withdraw`)}
        >
          Withdraw from Course
        </button>
      )}
    </aside>
  );
};
