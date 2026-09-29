import { CheckOutlined } from "@ant-design/icons";
import { Input, message } from "antd";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  findBuilderQuiz,
  findBuilderQuizQuestion,
  findCourseStructure,
  findInstructorCourse,
  removeBuilderQuizQuestion,
  saveBuilderQuizQuestion,
  slugify,
  type IBuilderQuizOption,
  type QuizQuestionType,
} from "@/components/instructor/instructor.data";
import { InstructorButton, InstructorPage, WarningPanel } from "@/components/instructor/instructor.ui";
import "./course.builder.scss";

const typeOptions: { value: QuizQuestionType; label: string }[] = [
  { value: "single", label: "Single answer" },
  { value: "multiple", label: "Multiple answers" },
  { value: "true-false", label: "True / False" },
];

const defaultOptionsFor = (type: QuizQuestionType): IBuilderQuizOption[] => {
  if (type === "true-false") {
    return [
      { id: slugify("true"), text: "True", correct: true },
      { id: slugify("false"), text: "False", correct: false },
    ];
  }
  return [
    { id: slugify("option-a"), text: "Follow the procedure", correct: true },
    { id: slugify("option-b"), text: "Skip required checks", correct: false },
    { id: slugify("option-c"), text: "Ignore instructions", correct: false },
  ];
};

const CourseBuilderQuizQuestionEdit = () => {
  const { courseId, quizId, questionId } = useParams();
  const navigate = useNavigate();
  const course = findInstructorCourse(courseId);
  const structure = findCourseStructure(courseId);
  const quiz = structure ? findBuilderQuiz(structure, quizId) : undefined;
  const existing = quiz ? findBuilderQuizQuestion(quiz, questionId) : undefined;

  const [type, setType] = useState<QuizQuestionType>(existing?.type ?? "single");
  const [text, setText] = useState(existing?.text ?? "Which actions follow the required process?");
  const [options, setOptions] = useState<IBuilderQuizOption[]>(
    existing?.options ?? defaultOptionsFor("single"),
  );

  if (!course || !structure || !quiz) return null;

  const base = `/instructor/courses/${course.id}/builder`;

  if (quiz.locked) {
    return (
      <InstructorPage className="builder-page">
        <span className="builder-crumb">Course Builder / Quiz Question Editing Locked</span>
        <div className="builder-hero">
          <h1>Quiz Question Editing Locked</h1>
        </div>
        <div className="builder-banner">
          <strong>Questions and answer keys locked</strong>
          <p>At least one Learner has attempted this Quiz.</p>
        </div>
        <div className="builder-update-card">
          <h2>Quiz configuration</h2>
          <p className="builder-lesson-intro">Question and answer editing is unavailable.</p>
          <p className="builder-lesson-intro">Time limit, n attempts and m-hour lock are also fixed.</p>
          <p className="builder-lesson-intro">
            Passing score and Required status are locked by Course Locked.
          </p>
          <div className="builder-actions">
            <InstructorButton onClick={() => navigate(`${base}/quizzes/${quiz.id}`)}>Back</InstructorButton>
            <InstructorButton
              type="primary"
              onClick={() =>
                navigate(`/instructor/courses/${course.id}/edit`, { state: { newVersion: true } })
              }
            >
              Create new Course version
            </InstructorButton>
          </div>
        </div>
      </InstructorPage>
    );
  }

  const changeType = (nextType: QuizQuestionType) => {
    setType(nextType);
    setOptions(defaultOptionsFor(nextType));
  };

  const toggleCorrect = (optionId: string) => {
    setOptions((current) =>
      current.map((option) => {
        if (type === "multiple") {
          return option.id === optionId ? { ...option, correct: !option.correct } : option;
        }
        return { ...option, correct: option.id === optionId };
      }),
    );
  };

  const updateOptionText = (optionId: string, value: string) => {
    setOptions((current) =>
      current.map((option) => (option.id === optionId ? { ...option, text: value } : option)),
    );
  };

  const addOption = () => {
    const letter = String.fromCharCode(65 + options.length);
    setOptions((current) => [
      ...current,
      { id: slugify(`option-${letter}`), text: "", correct: false },
    ]);
  };

  const handleSave = () => {
    if (!text.trim()) {
      message.warning("Enter the Question text.");
      return;
    }
    if (options.some((option) => !option.text.trim())) {
      message.warning("Every Answer option needs text.");
      return;
    }
    if (!options.some((option) => option.correct)) {
      message.warning("Mark at least one correct Answer.");
      return;
    }
    saveBuilderQuizQuestion(quiz, {
      id: existing?.id ?? slugify("question"),
      type,
      text: text.trim(),
      options,
    });
    message.success("Question saved.");
    navigate(`${base}/quizzes/${quiz.id}`);
  };

  const handleDelete = () => {
    if (!existing) return;
    removeBuilderQuizQuestion(quiz, existing.id);
    message.success("Question removed.");
    navigate(`${base}/quizzes/${quiz.id}`);
  };

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Course Builder / Edit Quiz Question</span>
      <div className="builder-hero">
        <h1>Edit Quiz Question</h1>
      </div>
      <div className="builder-grid">
        <div className="builder-update-card">
          <div className="instructor-pill-toggle builder-question-type-toggle">
            {typeOptions.map((option) => (
              <button
                type="button"
                key={option.value}
                className={type === option.value ? "instructor-pill-active" : ""}
                onClick={() => changeType(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <label className="instructor-form-label instructor-form-label-spaced">Question</label>
          <Input value={text} onChange={(event) => setText(event.target.value)} />

          <label className="instructor-form-label instructor-form-label-spaced">Answer options</label>
          <div className="builder-quiz-options">
            {options.map((option, index) => (
              <button
                type="button"
                key={option.id}
                className={`builder-quiz-option${option.correct ? " builder-quiz-option-correct" : ""}`}
                onClick={() => toggleCorrect(option.id)}
              >
                {option.correct && <CheckOutlined className="builder-quiz-option-check" />}
                {type === "true-false" ? (
                  <span>{option.text}</span>
                ) : (
                  <Input
                    variant="borderless"
                    value={option.text}
                    prefix={`${String.fromCharCode(65 + index)}.`}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => updateOptionText(option.id, event.target.value)}
                  />
                )}
              </button>
            ))}
          </div>
          {type !== "true-false" && (
            <div className="builder-actions builder-actions-split">
              <InstructorButton onClick={addOption}>+ Add option</InstructorButton>
              {existing && (
                <button type="button" className="builder-table-link builder-table-link-danger" onClick={handleDelete}>
                  Delete question
                </button>
              )}
            </div>
          )}
          <div className="builder-actions">
            {type === "true-false" && existing && (
              <button
                type="button"
                className="builder-table-link builder-table-link-danger"
                onClick={handleDelete}
                style={{ marginRight: "auto" }}
              >
                Delete question
              </button>
            )}
            <InstructorButton onClick={() => navigate(`${base}/quizzes/${quiz.id}`)}>Cancel</InstructorButton>
            <InstructorButton type="primary" onClick={handleSave}>
              Save question
            </InstructorButton>
          </div>
        </div>
        <div className="builder-side">
          <WarningPanel title="Question lock">
            Questions and answer keys lock after the first Quiz attempt.
          </WarningPanel>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderQuizQuestionEdit;
