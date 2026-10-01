import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import {
  canSubmitCourse,
  findCourseStructure,
  findInstructorCourse,
} from "@/components/instructor/instructor.data";
import { InstructorButton, InstructorPage } from "@/components/instructor/instructor.ui";
import type { ICourseBuilderContext } from "@/types/assessment.types";
import "./course.builder.scss";

const CourseBuilder = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  // Assignments come from Assessment Service through the builder layout; null while loading or unavailable.
  const { assignments } = useOutletContext<ICourseBuilderContext>();
  const course = findInstructorCourse(courseId);
  const structure = findCourseStructure(courseId);

  if (!course) return null;

  const base = `/instructor/courses/${course.id}/builder`;

  if (course.locked) {
    return (
      <InstructorPage className="builder-page">
        <span className="builder-crumb">Course Builder / Course Structure Locked</span>
        <div className="builder-hero">
          <h1>Course Structure Locked</h1>
        </div>
        <div className="builder-banner">
          <strong>First Enrollment recorded</strong>
          <p>Adding, deleting, reordering and Required flags are now locked.</p>
        </div>
        <div className="builder-update-card">
          <h2>What you can still update</h2>
          <ul>
            <li>Course description, type, objective and planned days</li>
            <li>Titles of Module, Lesson and learning materials</li>
            <li>Technical replacement of a broken learning file</li>
            <li>Assignment estimated effort</li>
          </ul>
          <div className="builder-actions">
            <InstructorButton
              type="primary"
              onClick={() => navigate(`/instructor/courses/${course.id}/versions/new`)}
            >
              Create new version
            </InstructorButton>
          </div>
        </div>
      </InstructorPage>
    );
  }

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Course Builder / Course Outline</span>
      <div className="builder-hero builder-hero-row">
        <h1>Course outline</h1>
        <div className="builder-hero-actions">
          {course.publishedVersion && course.publishedVersion !== course.version && (
            <InstructorButton onClick={() => navigate(`/instructor/courses/${course.id}/versions`)}>
              Version chain
            </InstructorButton>
          )}
          {canSubmitCourse(course) && (
            <InstructorButton
              type="primary"
              onClick={() => navigate(`/instructor/courses/${course.id}/submit`)}
            >
              Submit Course
            </InstructorButton>
          )}
        </div>
      </div>
      <h2 className="builder-hero-subhead">Structure</h2>
      <p className="builder-hero-help">
        Build a Module → Lesson tree. Add Video and Reading to each Lesson.
        <br />
        Attach a Quiz to a Module or Course; attach an Assignment to the Course.
      </p>
      <div className="builder-outline-list" style={{ marginTop: 24 }}>
        {structure?.modules.map((module) => {
          const moduleQuiz = structure.quizzes.find(
            (quiz) => quiz.location === "module" && quiz.moduleId === module.id,
          );
          return (
            <div className="builder-outline-card" key={module.id}>
              <div>
                <h2>{module.title}</h2>
                <p>
                  {module.required ? "Required" : "Optional"} • {module.lessons.length} Lesson
                  {module.lessons.length === 1 ? "" : "s"}
                  {moduleQuiz ? " • 1 Quiz" : ""}
                </p>
              </div>
              <div className="builder-outline-card-actions">
                {moduleQuiz && (
                  <InstructorButton onClick={() => navigate(`${base}/quizzes/${moduleQuiz.id}`)}>
                    View Quiz
                  </InstructorButton>
                )}
                <InstructorButton
                  disabled={course.locked}
                  onClick={() => navigate(`${base}/modules/${module.id}/lessons/new`)}
                >
                  + Add Lesson
                </InstructorButton>
                <InstructorButton onClick={() => navigate(`${base}/structure/edit`)}>
                  Edit
                </InstructorButton>
              </div>
            </div>
          );
        })}
        {structure && structure.modules.length > 0 && (
          <div className="builder-outline-card">
            <div>
              <h2>Course Assessments</h2>
              <p>
                {structure.quizzes.filter((quiz) => quiz.location === "course").length} Course Quiz
                {structure.quizzes.filter((quiz) => quiz.location === "course").length === 1 ? "" : "es"} •{" "}
                {assignments
                  ? `${assignments.length} Assignment${assignments.length === 1 ? "" : "s"}`
                  : "Assignments"}
              </p>
            </div>
            <div className="builder-outline-card-actions">
              <InstructorButton onClick={() => navigate(`${base}/quizzes`)}>Quizzes</InstructorButton>
              <InstructorButton onClick={() => navigate(`${base}/assignments`)}>Assignments</InstructorButton>
            </div>
          </div>
        )}
        {!structure && <p>No Modules yet. Use Add Module in the Curriculum Tree to get started.</p>}
      </div>
    </InstructorPage>
  );
};

export default CourseBuilder;
