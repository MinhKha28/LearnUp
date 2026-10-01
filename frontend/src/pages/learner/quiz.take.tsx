import { useMemo, useState } from "react";
import { Modal } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import {
  courseDetails,
  findQuiz,
  quizAttemptsRemaining,
  quizRecordedScore,
  type IQuizAttempt,
  type IQuizQuestion,
} from "@/components/learner/learner.data";
import {
  InfoPanel,
  LearnerButton,
  LearnerPage,
  PageHeader,
  StatCard,
  StatusTag,
  WarningPanel,
} from "@/components/learner/learner.ui";
import "./quiz.take.scss";

const questionTypeLabel = (type: IQuizQuestion["type"]) => {
  if (type === "single") return "Single answer";
  if (type === "multiple") return "Multiple answers";
  return "True / False";
};

const defaultAnswers = (questions: IQuizQuestion[]) => {
  const initial: Record<string, string[]> = {};
  questions.forEach((question) => {
    initial[question.id] = [...question.correctOptionIds];
  });
  return initial;
};

const isCorrect = (question: IQuizQuestion, selected: string[]) => {
  const correct = [...question.correctOptionIds].sort();
  const chosen = [...selected].sort();
  return correct.length === chosen.length && correct.every((id, index) => id === chosen[index]);
};

const QuizTake = () => {
  const { enrollmentId: courseId, quizId } = useParams();
  const navigate = useNavigate();
  const course = courseId ? courseDetails[courseId] : undefined;
  const quiz = course ? findQuiz(course, quizId) : undefined;

  const [answers, setAnswers] = useState<Record<string, string[]>>(() =>
    quiz ? defaultAnswers(quiz.questions) : {},
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [attempt, setAttempt] = useState<IQuizAttempt | undefined>(undefined);
  const [localAttempts, setLocalAttempts] = useState<IQuizAttempt[]>(quiz?.attempts ?? []);

  const answeredCount = useMemo(
    () => Object.values(answers).filter((value) => value.length > 0).length,
    [answers],
  );

  if (!course) {
    return null;
  }

  if (!quiz) {
    return (
      <LearnerPage className="quiz-take">
        <PageHeader eyebrow="ASSESSMENTS / QUIZ" title="Quiz not found" subtitle="" back />
      </LearnerPage>
    );
  }

  const toggleOption = (question: IQuizQuestion, optionId: string) => {
    setAnswers((prev) => {
      const current = prev[question.id] ?? [];
      if (question.type === "multiple") {
        const next = current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId];
        return { ...prev, [question.id]: next };
      }
      return { ...prev, [question.id]: [optionId] };
    });
  };

  const submitQuiz = () => {
    const correctCount = quiz.questions.filter((question) =>
      isCorrect(question, answers[question.id] ?? []),
    ).length;
    const score = Math.round((correctCount / quiz.questions.length) * 100);
    const passed = score >= quiz.minScore;
    const newAttempt: IQuizAttempt = {
      id: `att-${localAttempts.length + 1}`,
      submittedAt: new Date().toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      score,
      passed,
    };
    setLocalAttempts((prev) => [...prev, newAttempt]);
    setAttempt(newAttempt);
    setConfirmOpen(false);
  };

  if (quiz.locked && !attempt) {
    return (
      <>
        <PageHeader
          eyebrow="ASSESSMENTS / QUIZ"
          title={quiz.title}
          subtitle="This Quiz is temporarily locked for your account."
        />
        <div className="course-learning-content">
          <WarningPanel title="Temporary lock">
            You reached the consecutive attempt limit without meeting the pass score.
          </WarningPanel>
          <div className="quiz-locked-card">
            <span>You can try again at</span>
            <strong>{quiz.lockedUntil}</strong>
            <p>There is no lifetime attempt limit. Consecutive attempts reset when the lock ends.</p>
            <LearnerButton
              onClick={() => navigate(`/learner/courses/${course.id}/quizzes/${quiz.id}/history`)}
            >
              View Quiz history
            </LearnerButton>
          </div>
        </div>
      </>
    );
  }

  if (attempt) {
    const recordedScore = Math.max(quizRecordedScore({ ...quiz, attempts: localAttempts }), attempt.score);
    return (
      <>
        <PageHeader
          eyebrow="ASSESSMENTS / QUIZ RESULT"
          title="Quiz result"
          subtitle={`${quiz.title} • Automatically graded`}
        />
        <div className="course-learning-content">
          <div className="quiz-result-card">
            <StatusTag tone={attempt.passed ? "success" : "warning"}>
              {attempt.passed ? "Completed" : "Below threshold"}
            </StatusTag>
            <div className="quiz-result-stats">
              <StatCard label="Attempt score" value={`${attempt.score}%`} />
              <StatCard label="Recorded Quiz score" value={`${recordedScore}%`} />
              <StatCard label="Pass threshold" value={`${quiz.minScore}%`} />
            </div>
            <InfoPanel title="Scoring rule">
              The highest attempt is used as your recorded Quiz score.
            </InfoPanel>
          </div>
          <div className="quiz-result-next">
            <h3>Next steps</h3>
            <p>Review your answers and score for this attempt.</p>
            <p>View all attempts, remaining attempts and unlock time in Quiz history.</p>
            <div className="quiz-result-actions">
              <LearnerButton
                type="primary"
                onClick={() => navigate(`/learner/courses/${course.id}/quizzes/${quiz.id}/history`)}
              >
                View Quiz history
              </LearnerButton>
              <LearnerButton onClick={() => navigate(`/learner/courses/${course.id}`)}>
                Back to Course
              </LearnerButton>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="ASSESSMENTS / QUIZ"
        title={quiz.title}
        subtitle={`All ${quiz.questions.length} questions are listed below. Review every answer before submitting.`}
      />
      <div className="course-learning-content">
        <InfoPanel title="Quiz information">
          {`${quiz.requirement} • Time limit: ${quiz.timeLimitLabel} • Passing score: ${quiz.passingScoreLabel} • Attempts left: ${quizAttemptsRemaining(quiz)}`}
        </InfoPanel>
        {quiz.questions.map((question, index) => {
            const selected = answers[question.id] ?? [];
            return (
              <div className="quiz-question-card" key={question.id}>
                <div className="quiz-question-head">
                  <span className="quiz-question-pill">QUESTION {index + 1}</span>
                  <span className="quiz-question-type">{questionTypeLabel(question.type)}</span>
                </div>
                <h3>{question.text}</h3>
                <div className="quiz-options">
                  {question.options.map((option) => {
                    const isChecked = selected.includes(option.id);
                    return (
                      <button
                        type="button"
                        key={option.id}
                        className={`quiz-option${isChecked ? " selected" : ""}`}
                        onClick={() => toggleOption(question, option.id)}
                      >
                        <span
                          className={`quiz-option-marker quiz-option-marker-${
                            question.type === "multiple" ? "checkbox" : "radio"
                          }${isChecked ? " checked" : ""}`}
                        />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div className="quiz-footer">
            <div>
              <strong>{quiz.questions.length} questions</strong>
              <span>Single answer, multiple answers and true/false</span>
            </div>
            <LearnerButton type="primary" onClick={() => setConfirmOpen(true)}>
              Submit Quiz
            </LearnerButton>
          </div>
      </div>
      <Modal
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        footer={null}
        title={null}
        className="quiz-submit-modal"
      >
        <p className="quiz-modal-eyebrow">ASSESSMENTS / QUIZ</p>
        <h2>{quiz.title}</h2>
        <p className="quiz-modal-subtitle">Review your answers before submitting.</p>
        <div className="quiz-modal-body">
          <h3>Submit Quiz?</h3>
          <p className="quiz-modal-bold">The Quiz is graded automatically after submission.</p>
          <InfoPanel title="Attempt will be recorded">
            The highest Quiz score across attempts is the recorded score.
          </InfoPanel>
          <p>
            Answered questions: {answeredCount} of {quiz.questions.length}.
            <br />
            You can review your answers before confirming.
          </p>
        </div>
        <div className="quiz-modal-actions">
          <LearnerButton onClick={() => setConfirmOpen(false)}>Review answers</LearnerButton>
          <LearnerButton type="primary" onClick={submitQuiz}>
            Submit Quiz
          </LearnerButton>
        </div>
      </Modal>
    </>
  );
};

export default QuizTake;
