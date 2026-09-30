import { message } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import {
  findBuilderQuiz,
  findCourseStructure,
  findInstructorCourse,
  removeBuilderQuiz,
} from "@/components/instructor/instructor.data";
import { InstructorButton, InstructorPage } from "@/components/instructor/instructor.ui";
import "./course.builder.scss";
import "./course.builder.confirm.scss";

const CourseBuilderQuizDelete = () => {
  const { courseId, quizId } = useParams();
  const navigate = useNavigate();
  const course = findInstructorCourse(courseId);
  const structure = findCourseStructure(courseId);
  const quiz = structure ? findBuilderQuiz(structure, quizId) : undefined;

  if (!course || !structure || !quiz) return null;

  const base = `/instructor/courses/${course.id}/builder`;
  const canDelete = !course.locked && !quiz.locked;

  const handleDelete = () => {
    removeBuilderQuiz(structure, quiz.id);
    message.success("Quiz deleted.");
    navigate(`${base}/quizzes`);
  };

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Course Builder / Delete Quiz</span>
      <div className="builder-hero">
        <h1>Delete Quiz</h1>
      </div>
      <div className="builder-confirm-card">
        <div className="builder-confirm-warning">
          <strong>Delete Quiz?</strong>
          <p>This removes the Quiz from the Course or Module. Learner attempt data prevents deletion after lock.</p>
        </div>
        <p className="builder-confirm-note">
          Available only while the relevant Course and content rules allow deletion.
        </p>
        <div className="builder-confirm-actions">
          <InstructorButton onClick={() => navigate(-1)}>Cancel</InstructorButton>
          <InstructorButton type="primary" disabled={!canDelete} onClick={handleDelete}>
            Delete Quiz
          </InstructorButton>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderQuizDelete;
