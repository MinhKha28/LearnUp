import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  EyeOutlined,
  LockOutlined,
  QuestionCircleOutlined,
  UnorderedListOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { Tooltip } from "antd";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import type { ICourseBuilderOutletContext } from "@/components/layout/layout.instructor.course";
import { InfoPanel, InstructorButton, InstructorPage, StatusTag } from "@/components/instructor/instructor.ui";
import { assessmentErrorText, fetchQuizzesAPI } from "@/services/assessment.service";
import type { IQuizSummary } from "@/types/assessment.types";
import { QUIZ_LOCK_REASON_TEXT as LOCK_REASON_TEXT } from "@/utils/quiz.view";
import "./course.builder.scss";
import "./course.builder.assignment.scss";
import "./course.builder.quizzes.scss";

interface IQuizGroup {
  key: string;
  title: string;
  quizzes: IQuizSummary[];
}

const ComingSoon = ({ children }: { children: ReactNode }) => (
  <Tooltip title="Coming soon">
    <span className="builder-quiz-soon">{children}</span>
  </Tooltip>
);

const CourseBuilderQuizzes = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { structure } = useOutletContext<ICourseBuilderOutletContext>();
  const course = structure.course;
  const base = `/instructor/courses/${course.id}/builder`;
  // UC18.2: Draft, Rejected and Published Courses can take a new Quiz (BR-285, BR-69, BR-284).
  const canAdd = ["Draft", "Rejected", "Published"].includes(course.status);

  const [quizzes, setQuizzes] = useState<IQuizSummary[]>([]);
  const [courseLocked, setCourseLocked] = useState(false);
  const [courseStatus, setCourseStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!courseId) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      setErrorMessage("");
      try {
        const res = await fetchQuizzesAPI(courseId);
        if (!active) return;
        // The axios interceptor resolves HTTP errors too, so only res.data tells success apart.
        if (res.data) {
          setQuizzes(res.data.items);
          setCourseLocked(res.data.courseLocked);
          setCourseStatus(res.data.courseStatus);
        } else {
          setErrorMessage(assessmentErrorText(res, "Unable to load Quizzes."));
        }
      } catch {
        if (active) setErrorMessage("Unable to reach the Assessment service. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [courseId, reloadKey]);

  const retry = useCallback(() => setReloadKey((key) => key + 1), []);

  // BR-291: Module Quizzes follow their Module in outline order; Course-level Quizzes come last.
  const groups: IQuizGroup[] = structure.modules
    .map((module, index) => ({
      key: module.id,
      title: `Module ${index + 1}: ${module.title}`,
      quizzes: quizzes.filter((quiz) => quiz.moduleId === module.id),
    }))
    .filter((group) => group.quizzes.length > 0);
  const knownModuleIds = new Set(structure.modules.map((module) => module.id));
  const courseLevel = quizzes.filter((quiz) => quiz.moduleId === null);
  const unknownModule = quizzes.filter((quiz) => quiz.moduleId !== null && !knownModuleIds.has(quiz.moduleId));
  if (courseLevel.length > 0) {
    groups.push({ key: "course", title: "Course-level Quizzes", quizzes: courseLevel });
  }
  if (unknownModule.length > 0) {
    groups.push({ key: "other", title: "Other Quizzes", quizzes: unknownModule });
  }

  const submitted = courseStatus === "Submitted";
  const emptyQuizzes = quizzes.filter((quiz) => quiz.questionCount === 0).length;
  const requiredQuizzes = quizzes.filter((quiz) => quiz.isRequired).length;

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Course Builder / Quizzes</span>
      <div className="builder-hero">
        <h1>Quizzes</h1>
        <p>
          {loading
            ? "Loading..."
            : errorMessage
              ? course.name
              : `${quizzes.length} Quiz${quizzes.length === 1 ? "" : "zes"} in ${course.name}`}
        </p>
      </div>
      <div className="builder-grid">
        <div className="builder-update-card">
          {!loading && !errorMessage && submitted && (
            <div className="builder-banner">
              <strong>Course Submitted</strong>
              <p>{LOCK_REASON_TEXT.COURSE_SUBMITTED}</p>
            </div>
          )}
          {!loading && !errorMessage && courseLocked && (
            <div className="builder-banner">
              <strong>Course Locked</strong>
              <p>{LOCK_REASON_TEXT.COURSE_LOCKED}</p>
            </div>
          )}
          {!loading && !errorMessage && emptyQuizzes > 0 && (
            <div className="builder-banner">
              <strong>Quizzes without questions</strong>
              <p>
                {emptyQuizzes} Quiz{emptyQuizzes === 1 ? " has" : "zes have"} no questions yet. The Course cannot be
                submitted for review until every Quiz has at least one question.
              </p>
            </div>
          )}

          {errorMessage ? (
            <div className="builder-banner builder-banner-error">
              <strong>Quizzes could not be loaded</strong>
              <p>{errorMessage}</p>
              <InstructorButton className="builder-quiz-retry" onClick={retry}>
                Try again
              </InstructorButton>
            </div>
          ) : (
            <>
              <div className="builder-assign-stats">
                <div>
                  <strong>{quizzes.length}</strong>
                  <span>Total</span>
                </div>
                <div>
                  <strong>{requiredQuizzes}</strong>
                  <span>Required</span>
                </div>
                <div>
                  <strong>{emptyQuizzes}</strong>
                  <span>Without questions</span>
                </div>
              </div>

              {loading && <div className="builder-quiz-empty">Loading Quizzes...</div>}
              {!loading && quizzes.length === 0 && (
                <div className="builder-quiz-empty">
                  <strong>No Quizzes yet</strong>
                  <span>Create the first Quiz to check what Learners have understood.</span>
                </div>
              )}
              {!loading &&
                groups.map((group) => (
                  <section className="builder-quiz-group" key={group.key}>
                    <h3>{group.title}</h3>
                    <div className="builder-quiz-list">
                      {group.quizzes.map((quiz) => (
                        <article className="builder-quiz-card" key={quiz.id}>
                          <div className="builder-quiz-top">
                            <div className="builder-quiz-main">
                              <strong>{quiz.title}</strong>
                              <div className="builder-quiz-meta">
                                <span>
                                  <QuestionCircleOutlined /> {quiz.questionCount} question
                                  {quiz.questionCount === 1 ? "" : "s"}
                                </span>
                                <span>
                                  <ClockCircleOutlined />{" "}
                                  {quiz.timeLimitMinutes ? `${quiz.timeLimitMinutes} min` : "No time limit"}
                                </span>
                                <span>
                                  <CheckCircleOutlined /> Pass at {quiz.passingScore}%
                                </span>
                                <span>
                                  {quiz.maxConsecutiveAttempts} attempts, then {quiz.lockoutHours} h lock
                                </span>
                              </div>
                            </div>
                            <div className="builder-quiz-tags">
                              <StatusTag tone={quiz.isRequired ? "info" : "neutral"}>
                                {quiz.isRequired ? "Required" : "Optional"}
                              </StatusTag>
                              {quiz.locked ? (
                                <Tooltip
                                  title={
                                    <ul className="builder-quiz-reasons">
                                      {quiz.lockReasons.map((reason) => (
                                        <li key={reason}>{LOCK_REASON_TEXT[reason]}</li>
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

                          {quiz.questionCount === 0 && (
                            <div className="builder-quiz-alert">
                              <WarningOutlined /> No questions yet: the Course cannot be submitted for review.
                            </div>
                          )}

                          <div className="builder-quiz-actions">
                            <button
                              type="button"
                              className="builder-quiz-action"
                              onClick={() => navigate(`${base}/quizzes/${quiz.id}`)}
                            >
                              <EyeOutlined /> View details
                            </button>
                            <ComingSoon>
                              <button type="button" className="builder-quiz-action" disabled>
                                <UnorderedListOutlined /> Manage questions
                              </button>
                            </ComingSoon>
                            {submitted ? (
                              <Tooltip title={LOCK_REASON_TEXT.COURSE_SUBMITTED}>
                                <span className="builder-quiz-soon">
                                  <button type="button" className="builder-quiz-action danger" disabled>
                                    <DeleteOutlined /> Delete
                                  </button>
                                </span>
                              </Tooltip>
                            ) : (
                              <button
                                type="button"
                                className="builder-quiz-action danger"
                                onClick={() => navigate(`${base}/quizzes/${quiz.id}/delete`)}
                              >
                                <DeleteOutlined /> Delete
                              </button>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
            </>
          )}

          <div className="builder-actions">
            {canAdd ? (
              <InstructorButton type="primary" onClick={() => navigate(`${base}/quizzes/new`)}>
                + Create Quiz
              </InstructorButton>
            ) : (
              <Tooltip title={structure.lockReason ?? `The Course is ${course.status}, so no Quiz can be added.`}>
                <span className="builder-quiz-soon">
                  <InstructorButton type="primary" disabled>
                    + Create Quiz
                  </InstructorButton>
                </span>
              </Tooltip>
            )}
          </div>
        </div>
        <div className="builder-side">
          <InfoPanel title="Quiz placement">
            Attach Quizzes to a Module or directly to the Course. Module Quizzes appear after the Lessons of their
            Module; Course-level Quizzes appear at the end of the Course.
          </InfoPanel>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderQuizzes;
