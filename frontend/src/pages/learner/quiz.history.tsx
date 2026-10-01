import { useState } from "react";
import { Modal } from "antd";
import { useParams } from "react-router-dom";
import {
  courseDetails,
  findQuiz,
  quizAttemptsRemaining,
  quizRecordedScore,
  type IQuizAttempt,
} from "@/components/learner/learner.data";
import { LearnerButton, PageHeader, StatCard } from "@/components/learner/learner.ui";
import "./quiz.history.scss";

const QuizHistory = () => {
  const { enrollmentId: courseId, quizId } = useParams();
  const course = courseId ? courseDetails[courseId] : undefined;
  const quiz = course ? findQuiz(course, quizId) : undefined;
  const [viewing, setViewing] = useState<IQuizAttempt | undefined>(undefined);

  if (!course || !quiz) {
    return null;
  }

  const remaining = quizAttemptsRemaining(quiz);
  const recorded = quizRecordedScore(quiz);
  const attemptsDesc = [...quiz.attempts].reverse();

  return (
    <>
      <PageHeader
        eyebrow="ASSESSMENTS / QUIZ HISTORY"
        title="Quiz History"
        subtitle={`All attempts for ${quiz.title}.`}
      />
      <div className="course-learning-content">
          <div className="quiz-history-summary">
            <StatCard
              label="Recorded score"
              value={quiz.attempts.length > 0 ? `Highest attempt: ${recorded}%` : "No attempts yet"}
            />
            <StatCard
              label="Consecutive attempts remaining"
              value={quiz.locked ? "0 · Locked" : `${remaining} before temporary lock`}
            />
          </div>
          <div className="quiz-history-table-card">
            <h3>Attempt history</h3>
            <table className="quiz-history-table">
              <thead>
                <tr>
                  <th>Attempt</th>
                  <th>Submitted</th>
                  <th>Score</th>
                  <th>Result</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {attemptsDesc.map((attempt, index) => (
                  <tr key={attempt.id}>
                    <td>
                      <strong>Attempt {attemptsDesc.length - index}</strong>
                    </td>
                    <td>{attempt.submittedAt}</td>
                    <td>{attempt.score}%</td>
                    <td>{attempt.passed ? "Passed" : "Below threshold"}</td>
                    <td>
                      <LearnerButton onClick={() => setViewing(attempt)}>View attempt</LearnerButton>
                    </td>
                  </tr>
                ))}
                {attemptsDesc.length === 0 && (
                  <tr>
                    <td colSpan={5}>No attempts recorded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
      </div>
      <Modal
        open={Boolean(viewing)}
        onCancel={() => setViewing(undefined)}
        footer={null}
        title="Attempt details"
      >
        {viewing && (
          <div className="quiz-history-modal">
            <p>
              Submitted: <strong>{viewing.submittedAt}</strong>
            </p>
            <p>
              Score: <strong>{viewing.score}%</strong>
            </p>
            <p>
              Result: <strong>{viewing.passed ? "Passed" : "Below threshold"}</strong>
            </p>
          </div>
        )}
      </Modal>
    </>
  );
};

export default QuizHistory;
