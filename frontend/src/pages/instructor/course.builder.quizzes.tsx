import { useNavigate, useParams } from "react-router-dom";
import {
  findCourseStructure,
  findInstructorCourse,
  quizLocationLabel,
} from "@/components/instructor/instructor.data";
import { InfoPanel, InstructorButton, InstructorPage } from "@/components/instructor/instructor.ui";
import "./course.builder.scss";

const CourseBuilderQuizzes = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const course = findInstructorCourse(courseId);
  const structure = findCourseStructure(courseId);

  if (!course || !structure) return null;

  const base = `/instructor/courses/${course.id}/builder`;

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Course Builder / Quizzes</span>
      <div className="builder-hero">
        <h1>Quizzes</h1>
      </div>
      <div className="builder-grid">
        <div className="builder-update-card">
          <div className="builder-table">
            <div className="builder-table-row builder-table-head">
              <span>Quiz</span>
              <span>Location</span>
              <span>Required</span>
              <span>Lock</span>
            </div>
            {structure.quizzes.map((quiz) => (
              <div
                className="builder-table-row builder-table-row-clickable"
                key={quiz.id}
                onClick={() => navigate(`${base}/quizzes/${quiz.id}`)}
              >
                <strong>{quiz.title}</strong>
                <span>{quizLocationLabel(structure, quiz)}</span>
                <span>{quiz.required ? "Required" : "Optional"}</span>
                <span>{quiz.locked ? "Locked" : "Unlocked"}</span>
              </div>
            ))}
            {structure.quizzes.length === 0 && (
              <div className="builder-table-row">
                <span>No Quizzes yet.</span>
                <span />
                <span />
                <span />
              </div>
            )}
          </div>
          <div className="builder-actions">
            <InstructorButton
              type="primary"
              disabled={course.locked}
              onClick={() => navigate(`${base}/quizzes/new`)}
            >
              + Create Quiz
            </InstructorButton>
          </div>
        </div>
        <div className="builder-side">
          <InfoPanel title="Quiz placement">
            Attach Quizzes to a Module or directly to the Course.
          </InfoPanel>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderQuizzes;
