import {
  ArrowLeftOutlined,
  CheckCircleFilled,
  DeleteOutlined,
  EditOutlined,
  LockOutlined,
  UnorderedListOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { Skeleton, Tooltip } from "antd";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import type { ICourseBuilderOutletContext } from "@/components/layout/layout.instructor.course";
import { InfoPanel, InstructorButton, InstructorPage, StatusTag } from "@/components/instructor/instructor.ui";
import { assessmentErrorCode, assessmentErrorText, fetchQuizAPI } from "@/services/assessment.service";
import type { IAssessmentError, IQuizDetail, IQuizPermission } from "@/types/assessment.types";
import {
  combinePermissions,
  formatQuizScore,
  hasCorrectOption,
  optionLetter,
  permissionReasonTexts,
  QUIZ_BANNER_TITLE,
  QUIZ_LOCK_REASON_TEXT,
  quizBannerReasons,
  quizPlacementLabel,
  quizQuestionTypeLabel,
} from "@/utils/quiz.view";
import "./course.builder.scss";
import "./course.builder.assignment.scss";
import "./course.builder.quizzes.scss";
import "./course.builder.quiz.detail.scss";

type LoadError = { notFound: boolean; message: string };

const ReasonList = ({ permission }: { permission: IQuizPermission }) => (
  <ul className="builder-quiz-reasons">
    {permissionReasonTexts(permission).map((text) => (
      <li key={text}>{text}</li>
    ))}
  </ul>
);

/**
 * A slot for the action of a later use case: "Coming soon" until it is built, then disabled with its reasons
 * (BR-99) while the permission is blocked.
 */
const ActionSlot = ({
  ready,
  permission,
  children,
}: {
  ready: boolean;
  permission: IQuizPermission;
  children: (disabled: boolean) => ReactNode;
}) => {
  if (!ready) {
    return (
      <Tooltip title="Coming soon">
        <span className="builder-quiz-soon">{children(true)}</span>
      </Tooltip>
    );
  }
  if (!permission.allowed) {
    return (
      <Tooltip title={<ReasonList permission={permission} />}>
        <span className="builder-quiz-soon">{children(true)}</span>
      </Tooltip>
    );
  }
  return <>{children(false)}</>;
};

const ConfigRow = ({
  label,
  value,
  permission,
}: {
  label: string;
  value: ReactNode;
  permission?: IQuizPermission;
}) => (
  <div className="builder-quiz-detail-row">
    <dt>{label}</dt>
    <dd>
      <span className="builder-quiz-detail-value">
        {value}
        {permission && !permission.allowed && <LockOutlined aria-label="Locked" />}
      </span>
      {permission && !permission.allowed && (
        <span className="builder-quiz-detail-why">{permissionReasonTexts(permission).join(" ")}</span>
      )}
    </dd>
  </div>
);

const CourseBuilderQuizDetail = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const { structure } = useOutletContext<ICourseBuilderOutletContext>();
  const base = `/instructor/courses/${structure.course.id}/builder`;

  const [quiz, setQuiz] = useState<IQuizDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<LoadError | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

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
          // BR-287: a Quiz of another Instructor answers exactly like a missing one.
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

  const retry = useCallback(() => setReloadKey((key) => key + 1), []);
  const backToList = () => navigate(`${base}/quizzes`);

  if (loading) {
    return (
      <InstructorPage className="builder-page">
        <span className="builder-crumb">Course Builder / Quizzes / Quiz Detail</span>
        <div className="builder-update-card" aria-busy="true">
          <Skeleton active title paragraph={{ rows: 4 }} />
          <Skeleton active paragraph={{ rows: 6 }} />
        </div>
      </InstructorPage>
    );
  }

  if (error || !quiz) {
    return (
      <InstructorPage className="builder-page">
        <span className="builder-crumb">Course Builder / Quizzes / Quiz Detail</span>
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
            <InstructorButton onClick={backToList}>
              <ArrowLeftOutlined /> Back to Quizzes
            </InstructorButton>
            {!error?.notFound && (
              <InstructorButton type="primary" onClick={retry}>
                Try again
              </InstructorButton>
            )}
          </div>
        </div>
      </InstructorPage>
    );
  }

  const { permissions } = quiz;
  // UC18.4 edits the five configuration fields; the button opens as soon as one of them can change.
  const configPermission = combinePermissions([
    permissions.editTimeLimit,
    permissions.editAttemptRule,
    permissions.editPassingScore,
    permissions.editRequired,
  ]);
  const bannerReasons = quizBannerReasons(permissions);
  const onlyQuestionLocked = quiz.questions.length === 1 && !permissions.deleteLastQuestion.allowed;

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Course Builder / Quizzes / {quiz.title}</span>
      <div className="builder-hero builder-quiz-detail-hero">
        <div>
          <h1>{quiz.title}</h1>
          <p>{quizPlacementLabel(quiz, structure.modules)}</p>
        </div>
        <div className="builder-quiz-tags">
          <StatusTag tone={quiz.isRequired ? "info" : "neutral"}>{quiz.isRequired ? "Required" : "Optional"}</StatusTag>
          {quiz.locked ? (
            <Tooltip
              title={
                <ul className="builder-quiz-reasons">
                  {quiz.lockReasons.map((reason) => (
                    <li key={reason}>{QUIZ_LOCK_REASON_TEXT[reason]}</li>
                  ))}
                </ul>
              }
            >
              <span>
                <StatusTag tone="warning">
                  <LockOutlined /> Locked
                </StatusTag>
              </span>
            </Tooltip>
          ) : (
            <StatusTag tone="success">Unlocked</StatusTag>
          )}
          {quiz.disabled && <StatusTag tone="error">Disabled</StatusTag>}
        </div>
      </div>

      <div className="builder-grid">
        <div className="builder-update-card">
          {bannerReasons.map((reason) => (
            <div className="builder-banner" key={reason}>
              <strong>{QUIZ_BANNER_TITLE[reason]}</strong>
              <p>{QUIZ_LOCK_REASON_TEXT[reason]}</p>
            </div>
          ))}

          <section className="builder-quiz-detail-section">
            <h2>Configuration</h2>
            <dl className="builder-quiz-detail-config">
              <ConfigRow
                label="Time limit"
                value={quiz.timeLimitMinutes ? `${quiz.timeLimitMinutes} min` : "No time limit"}
                permission={permissions.editTimeLimit}
              />
              <ConfigRow
                label="Passing score"
                value={`${formatQuizScore(quiz.passingScore)} / 100`}
                permission={permissions.editPassingScore}
              />
              <ConfigRow
                label="Required"
                value={quiz.isRequired ? "Required" : "Optional"}
                permission={permissions.editRequired}
              />
              <ConfigRow
                label="Attempt limit"
                value={`${quiz.maxConsecutiveAttempts} attempts in a row, then ${quiz.lockoutHours} h lockout`}
                permission={permissions.editAttemptRule}
              />
              <ConfigRow label="Placement" value={quizPlacementLabel(quiz, structure.modules)} />
            </dl>
          </section>

          <section className="builder-quiz-detail-section">
            <h2>
              Questions and answer keys <span className="builder-quiz-detail-count">{quiz.questions.length}</span>
            </h2>
            {!permissions.editQuestions.allowed && (
              <p className="builder-quiz-detail-why">
                <LockOutlined /> {permissionReasonTexts(permissions.editQuestions).join(" ")}
              </p>
            )}

            {quiz.questions.length === 0 ? (
              <div className="builder-quiz-empty">
                <strong>No questions yet</strong>
                <span>The Course cannot be submitted for review until every Quiz has at least one question.</span>
              </div>
            ) : (
              <ol className="builder-quiz-detail-questions">
                {quiz.questions.map((question, index) => (
                  <li className="builder-quiz-detail-question" key={question.id}>
                    <div className="builder-quiz-detail-question-head">
                      <strong>Q{index + 1}.</strong>
                      <span className="builder-quiz-detail-question-text">{question.content}</span>
                      <StatusTag>{quizQuestionTypeLabel(question.type)}</StatusTag>
                    </div>
                    <ul className="builder-quiz-detail-options">
                      {question.options.map((option, optionIndex) => (
                        <li
                          key={option.id}
                          className={
                            option.isCorrect ? "builder-quiz-detail-option correct" : "builder-quiz-detail-option"
                          }
                        >
                          <span className="builder-quiz-detail-letter">{optionLetter(optionIndex)}</span>
                          <span className="builder-quiz-detail-option-text">{option.content}</span>
                          {option.isCorrect && (
                            <span className="builder-quiz-detail-correct">
                              <CheckCircleFilled /> Correct
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                    {!hasCorrectOption(question) && (
                      <div className="builder-quiz-alert">
                        <WarningOutlined /> No correct answer is marked for this question.
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
            {onlyQuestionLocked && (
              <p className="builder-quiz-detail-why">
                <LockOutlined /> {permissionReasonTexts(permissions.deleteLastQuestion).join(" ")}
              </p>
            )}
          </section>

          <div className="builder-quiz-actions">
            <InstructorButton onClick={backToList}>
              <ArrowLeftOutlined /> Back to Quizzes
            </InstructorButton>
            {/* UC18.4 — Update Quiz configuration */}
            <ActionSlot ready={false} permission={configPermission}>
              {(disabled) => (
                <button
                  type="button"
                  className="builder-quiz-action"
                  disabled={disabled}
                  onClick={() => navigate(`${base}/quizzes/${quiz.id}/edit`)}
                >
                  <EditOutlined /> Edit configuration
                </button>
              )}
            </ActionSlot>
            {/* UC18.3 — Manage Quiz questions */}
            <ActionSlot ready={false} permission={permissions.editQuestions}>
              {(disabled) => (
                <button type="button" className="builder-quiz-action" disabled={disabled}>
                  <UnorderedListOutlined /> Manage questions
                </button>
              )}
            </ActionSlot>
            {/* UC18.5 — Delete Quiz */}
            <ActionSlot ready permission={permissions.deleteQuiz}>
              {(disabled) => (
                <button
                  type="button"
                  className="builder-quiz-action danger"
                  disabled={disabled}
                  onClick={() => navigate(`${base}/quizzes/${quiz.id}/delete`)}
                >
                  <DeleteOutlined /> Delete Quiz
                </button>
              )}
            </ActionSlot>
          </div>
        </div>
        <div className="builder-side">
          <InfoPanel title="Scoring">
            Quizzes are graded automatically on a 0–100 scale. A Learner passes by reaching the passing score.
          </InfoPanel>
          <InfoPanel title="Quiz placement">
            Module Quizzes appear after the Lessons of their Module; Course-level Quizzes appear at the end of the
            Course.
          </InfoPanel>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderQuizDetail;
