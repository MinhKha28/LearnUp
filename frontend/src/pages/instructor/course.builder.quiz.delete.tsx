import { DeleteOutlined, WarningOutlined } from "@ant-design/icons";
import { message } from "antd";
import { useEffect, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import type { ICourseBuilderOutletContext } from "@/components/layout/layout.instructor.course";
import { InstructorButton, InstructorPage } from "@/components/instructor/instructor.ui";
import { assessmentErrorText, deleteQuizAPI, fetchQuizzesAPI } from "@/services/assessment.service";
import type { IQuizSummary } from "@/types/assessment.types";
import "./course.builder.scss";
import "./course.builder.assignment.scss";
import "./course.builder.confirm.scss";

const CourseBuilderQuizDelete = () => {
  const { courseId, quizId } = useParams();
  const navigate = useNavigate();
  const { structure } = useOutletContext<ICourseBuilderOutletContext>();
  const course = structure.course;
  const base = `/instructor/courses/${course.id}/builder`;

  const [quiz, setQuiz] = useState<IQuizSummary | null>(null);
  const [courseLocked, setCourseLocked] = useState(false);
  const [courseStatus, setCourseStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  // There is no single-Quiz endpoint yet (UC18.1), so the Quiz is found in the list of the Course.
  useEffect(() => {
    if (!courseId || !quizId) return;
    let active = true;
    const load = async () => {
      try {
        const res = await fetchQuizzesAPI(courseId);
        if (!active) return;
        if (res.data) {
          setQuiz(res.data.items.find((item) => item.id === quizId) ?? null);
          setCourseLocked(res.data.courseLocked);
          setCourseStatus(res.data.courseStatus);
        } else {
          message.error(assessmentErrorText(res, "Unable to load the Quiz."));
        }
      } catch {
        if (active) message.error("Unable to reach the Assessment service. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [courseId, quizId]);

  if (!quiz) {
    return (
      <InstructorPage className="builder-page">
        <span className="builder-crumb">Course Builder / Delete Quiz</span>
        <div className="builder-hero">
          <h1>{loading ? "Loading Quiz..." : "Quiz not found"}</h1>
        </div>
        {!loading && <InstructorButton onClick={() => navigate(`${base}/quizzes`)}>Back</InstructorButton>}
      </InstructorPage>
    );
  }

  // BR-92: blocked only when the Course is Locked AND the Quiz already has attempts.
  const blockedByData = courseLocked && quiz.hasAttempts;
  // BR-285: a Course in review accepts no change.
  const submitted = courseStatus === "Submitted";
  const canDelete = !blockedByData && !submitted;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await deleteQuizAPI(quiz.id);
      if (!res.data) {
        message.error(assessmentErrorText(res, "Unable to delete the Quiz."));
        return;
      }
      message.success("Quiz deleted.");
      navigate(`${base}/quizzes`);
    } catch {
      message.error("Unable to reach the Assessment service. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Course Builder / Delete Quiz</span>
      <div className="builder-hero">
        <h1>Delete Quiz</h1>
      </div>
      <div className="builder-confirm-card builder-delete-card">
        <div className="builder-delete-head">
          <span className="builder-delete-icon">
            <DeleteOutlined />
          </span>
          <div>
            <strong>Delete "{quiz.title}"?</strong>
            <p>This action cannot be undone.</p>
          </div>
        </div>

        <div className="builder-delete-list">
          <span>This will permanently remove:</span>
          <ul>
            <li>
              The Quiz and its {quiz.questionCount} question{quiz.questionCount === 1 ? "" : "s"}
            </li>
            {quiz.hasAttempts && <li>All Learner attempts and answers recorded for this Quiz</li>}
          </ul>
        </div>

        {blockedByData && (
          <p className="builder-delete-blocked">
            <WarningOutlined /> This Quiz already has attempts and the Course is Locked, so it cannot be deleted.
            Create a new Course version to remove it.
          </p>
        )}
        {submitted && (
          <p className="builder-delete-blocked">
            <WarningOutlined /> The Course is Submitted for review, so nothing can be changed until it is withdrawn.
          </p>
        )}
        <div className="builder-confirm-actions">
          <InstructorButton onClick={() => navigate(`${base}/quizzes`)}>Cancel</InstructorButton>
          <InstructorButton type="primary" danger disabled={!canDelete} loading={deleting} onClick={handleDelete}>
            Delete Quiz
          </InstructorButton>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderQuizDelete;
