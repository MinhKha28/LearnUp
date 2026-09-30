import { useNavigate, useParams } from "react-router-dom";
import {
  findBuilderQuiz,
  findCourseStructure,
  findInstructorCourse,
  quizLocationLabel,
  quizQuestionTypeLabel,
} from "@/components/instructor/instructor.data";
import { InfoPanel, InstructorButton, InstructorPage } from "@/components/instructor/instructor.ui";
import "./course.builder.scss";

const CourseBuilderQuizDetail = () => {
  const { courseId, quizId } = useParams();
  const navigate = useNavigate();
  const course = findInstructorCourse(courseId);
  const structure = findCourseStructure(courseId);
  const quiz = structure ? findBuilderQuiz(structure, quizId) : undefined;

  if (!course || !structure || !quiz) return null;

  const base = `/instructor/courses/${course.id}/builder`;

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Course Builder / Quiz Detail</span>
      <div className="builder-hero">
        <h1>Quiz Detail</h1>
      </div>
      <div className="builder-grid">
        <div className="builder-update-card">
          <h2>Configuration</h2>
          <p className="builder-lesson-intro">
            {quizLocationLabel(structure, quiz)} · {quiz.required ? "Required" : "Optional"} ·{" "}
            {quiz.timeLimitMinutes ? `${quiz.timeLimitMinutes} min` : "[Time limit]"}
          </p>
          <p className="builder-lesson-intro">
            Pass score: {quiz.passingScore ?? "[Configured]"} ·{" "}
            {quiz.attempts ?? "n"} attempts / {quiz.lockHours ?? "m"} hours lock
          </p>
          <hr className="builder-divider" />
          <h2>Questions and answer keys</h2>
          <div className="builder-outline-list">
            {quiz.questions.map((question, index) => (
              <button
                type="button"
                className="builder-outline-card builder-outline-card-plain"
                key={question.id}
                onClick={() => navigate(`${base}/quizzes/${quiz.id}/questions/${question.id}/edit`)}
              >
                <div>
                  <h2>
                    Q{index + 1}. {question.text}
                  </h2>
                  <p>
                    {quizQuestionTypeLabel[question.type]} • Correct answer configured
                  </p>
                </div>
              </button>
            ))}
            {quiz.questions.length === 0 && <p className="builder-lesson-intro">No Questions yet.</p>}
          </div>
          <div className="builder-actions builder-actions-split">
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <InstructorButton onClick={() => navigate(`${base}/quizzes/${quiz.id}/edit`)}>
                Edit configuration
              </InstructorButton>
              <button
                type="button"
                className="builder-table-link builder-table-link-danger"
                onClick={() => navigate(`/instructor/courses/${course.id}/builder/quizzes/${quiz.id}/delete`)}
              >
                Delete Quiz
              </button>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <InstructorButton onClick={() => navigate(`${base}/quizzes/${quiz.id}/questions/new`)}>
                + Add question
              </InstructorButton>
              <InstructorButton
                type="primary"
                onClick={() =>
                  navigate(
                    quiz.questions.length > 0
                      ? `${base}/quizzes/${quiz.id}/questions/${quiz.questions[0].id}/edit`
                      : `${base}/quizzes/${quiz.id}/questions/new`,
                  )
                }
              >
                Edit questions
              </InstructorButton>
            </div>
          </div>
        </div>
        <div className="builder-side">
          <InfoPanel title="Scoring">
            Quiz grading is automatic; Learner highest attempt is recorded.
          </InfoPanel>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderQuizDetail;
