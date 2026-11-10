import { ArrowLeftOutlined, CheckOutlined, DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Checkbox, Input, Radio, Skeleton, message } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { FieldError } from "@/components/instructor/form.field";
import type { ICourseBuilderOutletContext } from "@/components/layout/layout.instructor.course";
import { InfoPanel, InstructorButton, InstructorPage } from "@/components/instructor/instructor.ui";
import {
  assessmentErrorCode,
  assessmentErrorText,
  createQuizQuestionAPI,
  fetchQuizAPI,
} from "@/services/assessment.service";
import type {
  IAssessmentError,
  ICreateQuizQuestionReq,
  IQuizDetail,
  QuizQuestionType,
} from "@/types/assessment.types";
import {
  optionLetter,
  permissionReasonTexts,
  QUIZ_BANNER_TITLE,
  QUIZ_LOCK_REASON_TEXT,
  quizBannerReasons,
  quizQuestionTypeLabel,
} from "@/utils/quiz.view";
import "./course.create.scss";
import "./course.builder.scss";
import "./course.builder.assignment.scss";
import "./course.builder.quiz.detail.scss";

// Same limits as the server (quiz-question-rules.ts and the column sizes).
const QUESTION_MAX_LENGTH = 2000;
const OPTION_MAX_LENGTH = 500;
const OPTIONS_MIN = 2;
const OPTIONS_MAX = 10;
const STARTING_OPTIONS = 4;

const QUESTION_TYPES: QuizQuestionType[] = ["SingleChoice", "MultipleChoice", "TrueFalse"];

// Answers that mean the Quiz changed meanwhile (someone started it, the Course was submitted): load it again.
const RELOAD_CODES = ["QUIZ_HAS_ATTEMPTS", "COURSE_NOT_EDITABLE", "QUIZ_NOT_FOUND"];

type LoadError = { notFound: boolean; message: string };
type DraftOption = { key: number; content: string; isCorrect: boolean };

const CourseBuilderQuizQuestionCreate = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const { structure } = useOutletContext<ICourseBuilderOutletContext>();
  const base = `/instructor/courses/${structure.course.id}/builder`;
  const detailPath = `${base}/quizzes/${quizId}`;

  const [quiz, setQuiz] = useState<IQuizDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<LoadError | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const nextKey = useRef(0);
  const newOption = (): DraftOption => ({ key: nextKey.current++, content: "", isCorrect: false });

  const [type, setType] = useState<QuizQuestionType>("SingleChoice");
  const [content, setContent] = useState("");
  const [options, setOptions] = useState<DraftOption[]>(() =>
    Array.from({ length: STARTING_OPTIONS }, () => newOption()),
  );
  const [correctAnswer, setCorrectAnswer] = useState<boolean | null>(null);

  useEffect(() => {
    if (!quizId) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchQuizAPI(quizId);
        if (!active) return;
        // The axios interceptor resolves HTTP errors too, so only res.data tells success apart.
        if (res.data) {
          setQuiz(res.data);
        } else {
          const { statusCode } = res as unknown as IAssessmentError;
          // A Quiz of another Instructor answers exactly like a missing one.
          const notFound =
            assessmentErrorCode(res).code === "QUIZ_NOT_FOUND" || statusCode === 404 || statusCode === 400;
          setQuiz(null);
          setError({ notFound, message: assessmentErrorText(res, "Unable to load the Quiz.") });
        }
      } catch {
        if (active) {
          setQuiz(null);
          setError({ notFound: false, message: "Unable to reach the Assessment service. Please try again." });
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [quizId, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  if (loading && !quiz) {
    return (
      <InstructorPage className="builder-page">
        <span className="builder-crumb">Course Builder / Add Quiz Question</span>
        <div className="builder-update-card" aria-busy="true">
          <Skeleton active paragraph={{ rows: 6 }} />
        </div>
      </InstructorPage>
    );
  }

  if (error || !quiz) {
    return (
      <InstructorPage className="builder-page">
        <span className="builder-crumb">Course Builder / Add Quiz Question</span>
        <div className="builder-update-card">
          <div className="builder-banner builder-banner-error">
            <strong>{error?.notFound ? "Quiz not found" : "The Quiz could not be loaded"}</strong>
            <p>
              {error?.notFound
                ? "This Quiz does not exist or is not in a Course you are in charge of."
                : (error?.message ?? "Unable to load the Quiz.")}
            </p>
          </div>
          <div className="builder-actions">
            <InstructorButton onClick={() => navigate(`${base}/quizzes`)}>
              <ArrowLeftOutlined /> Back to Quizzes
            </InstructorButton>
            {!error?.notFound && (
              <InstructorButton type="primary" onClick={reload}>
                Try again
              </InstructorButton>
            )}
          </div>
        </div>
      </InstructorPage>
    );
  }

  // BR-117: no attempt yet. BR-83: Course not Submitted (nor archived / disabled). A Locked Course does not block it.
  const permission = quiz.permissions.editQuestions;
  const open = permission.allowed;
  const isChoice = type !== "TrueFalse";

  // Same rules as the server, so the Instructor sees every problem before sending.
  const trimmed = options.map((option) => option.content.trim());
  const correctCount = options.filter((option) => option.isCorrect).length;
  const lowered = trimmed.map((text) => text.toLowerCase());
  const duplicated = new Set(lowered.filter((text, index) => text && lowered.indexOf(text) !== index));

  const contentError = !content.trim()
    ? "Enter the question."
    : content.trim().length > QUESTION_MAX_LENGTH
      ? `The question can have at most ${QUESTION_MAX_LENGTH} characters.`
      : null;
  const optionError = (text: string): string | null => {
    if (!text) return "Enter the answer text.";
    if (text.length > OPTION_MAX_LENGTH) return `At most ${OPTION_MAX_LENGTH} characters.`;
    if (duplicated.has(text.toLowerCase())) return "Two answers have the same text.";
    return null;
  };
  let keyError: string | null = null;
  if (isChoice) {
    if (options.length < OPTIONS_MIN || options.length > OPTIONS_MAX) {
      keyError = `A choice question needs ${OPTIONS_MIN} to ${OPTIONS_MAX} answers.`;
    } else if (type === "SingleChoice" && correctCount !== 1) {
      keyError = "Mark exactly one correct answer.";
    } else if (type === "MultipleChoice" && correctCount < 1) {
      keyError = "Mark at least one correct answer.";
    } else if (type === "MultipleChoice" && correctCount === options.length) {
      keyError = "Leave at least one answer incorrect.";
    }
  } else if (correctAnswer === null) {
    keyError = "Choose whether the statement is True or False.";
  }
  const hasErrors =
    !!contentError || !!keyError || (isChoice && trimmed.some((text) => optionError(text) !== null));

  const changeType = (next: QuizQuestionType) => {
    setType(next);
    // Going to a single answer keeps only the first answer marked correct.
    if (next === "SingleChoice") {
      const first = options.findIndex((option) => option.isCorrect);
      setOptions((current) => current.map((option, index) => ({ ...option, isCorrect: index === first })));
    }
  };

  const markCorrect = (key: number, checked: boolean) => {
    setOptions((current) =>
      current.map((option) => {
        if (type === "MultipleChoice") return option.key === key ? { ...option, isCorrect: checked } : option;
        return { ...option, isCorrect: option.key === key };
      }),
    );
  };

  const changeOptionText = (key: number, value: string) => {
    setOptions((current) => current.map((option) => (option.key === key ? { ...option, content: value } : option)));
  };

  const addOption = () => setOptions((current) => [...current, newOption()]);
  const removeOption = (key: number) => setOptions((current) => current.filter((option) => option.key !== key));

  const handleSave = async () => {
    setSubmitted(true);
    if (hasErrors) {
      message.warning("Please fix the highlighted fields.");
      return;
    }
    const payload: ICreateQuizQuestionReq = isChoice
      ? {
          type,
          content: content.trim(),
          options: options.map((option, index) => ({ content: trimmed[index], isCorrect: option.isCorrect })),
        }
      : { type, content: content.trim(), correctAnswer: correctAnswer! };

    setSaving(true);
    try {
      const res = await createQuizQuestionAPI(quiz.id, payload);
      if (!res.data) {
        message.error(assessmentErrorText(res, "Unable to add the question."));
        // The form stays as typed; only the Quiz state (banners, permission) is loaded again.
        if (RELOAD_CODES.includes(assessmentErrorCode(res).code ?? "")) reload();
        return;
      }
      message.success(`Question added. This Quiz now has ${res.data.questionCount} question(s).`);
      navigate(detailPath);
    } catch {
      message.error("Unable to reach the Assessment service. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Course Builder / Quizzes / {quiz.title} / Add Question</span>
      <div className="builder-hero">
        <h1>Add Quiz Question</h1>
        <p>
          {quiz.title} · {quiz.questions.length} question(s) so far
        </p>
      </div>
      <div className="builder-grid">
        <div className="builder-update-card">
          {quizBannerReasons(quiz.permissions).map((reason) => (
            <div className="builder-banner" key={reason}>
              <strong>{QUIZ_BANNER_TITLE[reason]}</strong>
              <p>{QUIZ_LOCK_REASON_TEXT[reason]}</p>
            </div>
          ))}
          {!open && (
            <p className="builder-quiz-detail-why">Questions cannot be added: {permissionReasonTexts(permission).join(" ")}</p>
          )}

          <label className="instructor-form-label instructor-form-label-spaced">Question type</label>
          <Radio.Group
            className="builder-question-type-toggle"
            optionType="button"
            buttonStyle="solid"
            disabled={!open}
            value={type}
            onChange={(event) => changeType(event.target.value as QuizQuestionType)}
            options={QUESTION_TYPES.map((value) => ({ label: quizQuestionTypeLabel(value), value }))}
          />

          <label className="instructor-form-label instructor-form-label-spaced">Question</label>
          <Input.TextArea
            disabled={!open}
            value={content}
            autoSize={{ minRows: 2, maxRows: 8 }}
            count={{ show: true, max: QUESTION_MAX_LENGTH }}
            status={submitted && contentError ? "error" : undefined}
            placeholder={type === "TrueFalse" ? "Write a statement the Learner marks True or False" : "Write the question"}
            onChange={(event) => setContent(event.target.value)}
          />
          {submitted && <FieldError message={contentError} />}

          <label className="instructor-form-label instructor-form-label-spaced">
            {type === "TrueFalse"
              ? "Correct answer"
              : type === "SingleChoice"
                ? "Answers (select the one correct answer)"
                : "Answers (tick every correct answer)"}
          </label>

          {isChoice ? (
            <div className="builder-quiz-options">
              {options.map((option, index) => {
                const text = trimmed[index];
                const rowError = submitted ? optionError(text) : null;
                return (
                  <div key={option.key}>
                    <div className={`builder-quiz-option${option.isCorrect ? " builder-quiz-option-correct" : ""}`}>
                      {type === "SingleChoice" ? (
                        <Radio
                          aria-label={`Answer ${optionLetter(index)} is correct`}
                          disabled={!open}
                          checked={option.isCorrect}
                          onChange={() => markCorrect(option.key, true)}
                        />
                      ) : (
                        <Checkbox
                          aria-label={`Answer ${optionLetter(index)} is correct`}
                          disabled={!open}
                          checked={option.isCorrect}
                          onChange={(event) => markCorrect(option.key, event.target.checked)}
                        />
                      )}
                      <Input
                        variant="borderless"
                        disabled={!open}
                        value={option.content}
                        prefix={`${optionLetter(index)}.`}
                        count={{ show: option.content.length > OPTION_MAX_LENGTH - 50, max: OPTION_MAX_LENGTH }}
                        placeholder="Answer text"
                        onChange={(event) => changeOptionText(option.key, event.target.value)}
                      />
                      {option.isCorrect && <CheckOutlined className="builder-quiz-option-check" />}
                      {open && options.length > OPTIONS_MIN && (
                        <button
                          type="button"
                          className="builder-table-link builder-table-link-danger"
                          aria-label={`Remove answer ${optionLetter(index)}`}
                          onClick={() => removeOption(option.key)}
                        >
                          <DeleteOutlined />
                        </button>
                      )}
                    </div>
                    <FieldError message={rowError} />
                  </div>
                );
              })}
            </div>
          ) : (
            <Radio.Group
              optionType="button"
              buttonStyle="solid"
              disabled={!open}
              value={correctAnswer}
              onChange={(event) => setCorrectAnswer(event.target.value as boolean)}
              options={[
                { label: "True", value: true },
                { label: "False", value: false },
              ]}
            />
          )}
          {submitted && <FieldError message={keyError} />}

          {isChoice && open && options.length < OPTIONS_MAX && (
            <div className="builder-actions builder-actions-split">
              <InstructorButton onClick={addOption}>
                <PlusOutlined /> Add answer
              </InstructorButton>
            </div>
          )}

          <div className="builder-actions">
            <InstructorButton onClick={() => navigate(detailPath)}>Cancel</InstructorButton>
            <InstructorButton type="primary" loading={saving} disabled={!open} onClick={handleSave}>
              Add question
            </InstructorButton>
          </div>
        </div>
        <div className="builder-side">
          <InfoPanel title="Question types">
            Single answer: exactly one correct answer. Multiple answers: at least one correct and one incorrect
            answer. True / False: choose which one is correct. Every type is graded automatically.
          </InfoPanel>
          <InfoPanel title="Scoring">
            Every question weighs the same. A question counts as correct only when the Learner picks exactly the
            correct answers; there is no partial credit.
          </InfoPanel>
          <InfoPanel title="Question lock">
            Questions can only be added while no Learner has started this Quiz and the Course is not Submitted.
          </InfoPanel>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderQuizQuestionCreate;
