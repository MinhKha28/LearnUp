import { ArrowLeftOutlined, LockOutlined } from "@ant-design/icons";
import { Radio, Skeleton, message } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { NumberField } from "@/components/instructor/form.field";
import type { ICourseBuilderOutletContext } from "@/components/layout/layout.instructor.course";
import { InfoPanel, InstructorButton, InstructorPage } from "@/components/instructor/instructor.ui";
import { assessmentErrorCode, assessmentErrorText, fetchQuizAPI, updateQuizConfigAPI } from "@/services/assessment.service";
import type { IAssessmentError, IQuizDetail, IQuizPermission, IUpdateQuizConfigReq } from "@/types/assessment.types";
import { permissionReasonTexts, QUIZ_BANNER_TITLE, QUIZ_LOCK_REASON_TEXT, quizBannerReasons } from "@/utils/quiz.view";
import {
  ATTEMPTS_RULE,
  LOCK_HOURS_RULE,
  QUIZ_PASSING_SCORE_RULE,
  TIME_LIMIT_RULE,
  validateNumber,
} from "@/utils/validation";
import "./course.create.scss";
import "./course.builder.scss";
import "./course.builder.assignment.scss";
import "./course.builder.quiz.detail.scss";

// On edit, n and m always have a value, so they are required here (on create they fall back to the platform default).
const REQUIRED_ATTEMPTS_RULE = { ...ATTEMPTS_RULE, required: true };
const REQUIRED_LOCK_HOURS_RULE = { ...LOCK_HOURS_RULE, required: true };

// Answers that mean the permissions shown are out of date: show the message and load the Quiz again.
const RELOAD_CODES = ["QUIZ_CONFIG_LOCKED", "COURSE_NOT_EDITABLE"];

type LoadError = { notFound: boolean; message: string };

/** BR-99: why a field cannot be changed, right under it. */
const LockReason = ({ permission }: { permission: IQuizPermission }) =>
  permission.allowed ? null : (
    <p className="builder-quiz-detail-why">
      <LockOutlined aria-label="Locked" /> {permissionReasonTexts(permission).join(" ")}
    </p>
  );

const CourseBuilderQuizConfigurationEdit = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const { structure } = useOutletContext<ICourseBuilderOutletContext>();
  const base = `/instructor/courses/${structure.course.id}/builder`;

  const [quiz, setQuiz] = useState<IQuizDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<LoadError | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [timeLimit, setTimeLimit] = useState<number | null>(null);
  const [attempts, setAttempts] = useState<number | null>(null);
  const [lockHours, setLockHours] = useState<number | null>(null);
  const [passingScore, setPassingScore] = useState<number | null>(null);
  const [isRequired, setIsRequired] = useState(false);

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
        const loaded = res.data;
        if (loaded) {
          setQuiz(loaded);
          setTimeLimit(loaded.timeLimitMinutes);
          setAttempts(loaded.maxConsecutiveAttempts);
          setLockHours(loaded.lockoutHours);
          setPassingScore(loaded.passingScore);
          setIsRequired(loaded.isRequired);
          setSubmitted(false);
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

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);
  const detailPath = `${base}/quizzes/${quizId}`;

  if (loading && !quiz) {
    return (
      <InstructorPage className="builder-page">
        <span className="builder-crumb">Course Builder / Edit Quiz Configuration</span>
        <div className="builder-update-card" aria-busy="true">
          <Skeleton active paragraph={{ rows: 6 }} />
        </div>
      </InstructorPage>
    );
  }

  if (error || !quiz) {
    return (
      <InstructorPage className="builder-page">
        <span className="builder-crumb">Course Builder / Edit Quiz Configuration</span>
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

  const { permissions } = quiz;
  // BR-97: time limit, n and m freeze once a Learner has started the Quiz. BR-94: passing score and Required freeze
  // when the Course is Locked. BR-285: everything freezes while the Course is Submitted, archived or disabled.
  const timeLimitOpen = permissions.editTimeLimit.allowed;
  const attemptRuleOpen = permissions.editAttemptRule.allowed;
  const passingScoreOpen = permissions.editPassingScore.allowed;
  const requiredOpen = permissions.editRequired.allowed;
  const anyOpen = timeLimitOpen || attemptRuleOpen || passingScoreOpen || requiredOpen;

  // Frozen fields are not checked: the user cannot change them, so they cannot be wrong.
  const errors = {
    timeLimit: timeLimitOpen ? validateNumber(timeLimit, TIME_LIMIT_RULE) : null,
    attempts: attemptRuleOpen ? validateNumber(attempts, REQUIRED_ATTEMPTS_RULE) : null,
    lockHours: attemptRuleOpen ? validateNumber(lockHours, REQUIRED_LOCK_HOURS_RULE) : null,
    passingScore: passingScoreOpen ? validateNumber(passingScore, QUIZ_PASSING_SCORE_RULE) : null,
  };

  const handleSave = async () => {
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) {
      message.warning("Please fix the highlighted fields.");
      return;
    }

    // Send only what changed, so untouched frozen fields never trip the server-side rules.
    const payload: IUpdateQuizConfigReq = {};
    if (timeLimitOpen && timeLimit !== quiz.timeLimitMinutes) payload.timeLimitMinutes = timeLimit!;
    if (attemptRuleOpen && attempts !== quiz.maxConsecutiveAttempts) payload.maxConsecutiveAttempts = attempts!;
    if (attemptRuleOpen && lockHours !== quiz.lockoutHours) payload.lockoutHours = lockHours!;
    if (passingScoreOpen && passingScore !== quiz.passingScore) payload.passingScore = passingScore!;
    if (requiredOpen && isRequired !== quiz.isRequired) payload.isRequired = isRequired;

    if (Object.keys(payload).length === 0) {
      message.info("No changes to save.");
      return;
    }

    setSaving(true);
    try {
      const res = await updateQuizConfigAPI(quiz.id, payload);
      if (!res.data) {
        message.error(assessmentErrorText(res, "Unable to save the Quiz settings."));
        // Someone started the Quiz or the Course changed meanwhile: show the fields as they are now (BR-99).
        if (RELOAD_CODES.includes(assessmentErrorCode(res).code ?? "")) reload();
        return;
      }
      message.success("Quiz settings saved.");
      navigate(detailPath);
    } catch {
      message.error("Unable to reach the Assessment service. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Course Builder / Quizzes / {quiz.title} / Edit Configuration</span>
      <div className="builder-hero">
        <h1>Edit Quiz Configuration</h1>
        <p>{quiz.title}</p>
      </div>
      <div className="builder-grid">
        <div className="builder-update-card">
          {quizBannerReasons(permissions).map((reason) => (
            <div className="builder-banner" key={reason}>
              <strong>{QUIZ_BANNER_TITLE[reason]}</strong>
              <p>{QUIZ_LOCK_REASON_TEXT[reason]}</p>
            </div>
          ))}

          <div className="builder-field-row">
            <div>
              <label className="instructor-form-label instructor-form-label-spaced">Time limit (minutes, 1-1440)</label>
              <NumberField
                rule={TIME_LIMIT_RULE}
                showError={submitted}
                disabled={!timeLimitOpen}
                value={timeLimit}
                onChange={setTimeLimit}
              />
              <LockReason permission={permissions.editTimeLimit} />
            </div>
            <div>
              <label className="instructor-form-label instructor-form-label-spaced">Passing score (above 0, max 100)</label>
              <NumberField
                rule={QUIZ_PASSING_SCORE_RULE}
                showError={submitted}
                disabled={!passingScoreOpen}
                value={passingScore}
                onChange={setPassingScore}
              />
              <LockReason permission={permissions.editPassingScore} />
            </div>
            <div>
              <label className="instructor-form-label instructor-form-label-spaced">Consecutive attempts (n)</label>
              <NumberField
                rule={REQUIRED_ATTEMPTS_RULE}
                showError={submitted}
                disabled={!attemptRuleOpen}
                value={attempts}
                onChange={setAttempts}
              />
              <LockReason permission={permissions.editAttemptRule} />
            </div>
            <div>
              <label className="instructor-form-label instructor-form-label-spaced">Temporary lock (m hours)</label>
              <NumberField
                rule={REQUIRED_LOCK_HOURS_RULE}
                showError={submitted}
                disabled={!attemptRuleOpen}
                value={lockHours}
                onChange={setLockHours}
              />
              <LockReason permission={permissions.editAttemptRule} />
            </div>
          </div>

          <label className="instructor-form-label instructor-form-label-spaced">Certificate requirement</label>
          <Radio.Group
            optionType="button"
            buttonStyle="solid"
            disabled={!requiredOpen}
            value={isRequired}
            onChange={(event) => setIsRequired(event.target.value as boolean)}
            options={[
              { label: "Required", value: true },
              { label: "Optional", value: false },
            ]}
          />
          <LockReason permission={permissions.editRequired} />

          <div className="builder-actions">
            <InstructorButton onClick={() => navigate(detailPath)}>Cancel</InstructorButton>
            <InstructorButton type="primary" loading={saving} disabled={!anyOpen} onClick={handleSave}>
              Save settings
            </InstructorButton>
          </div>
        </div>
        <div className="builder-side">
          <InfoPanel title="Edit conditions">
            Time limit, n and m lock as soon as a Learner starts the Quiz, even before submitting. The passing score
            and Required setting lock once the Course is Locked.
          </InfoPanel>
          <InfoPanel title="Questions">Questions and answers are edited separately and lock with the first attempt.</InfoPanel>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderQuizConfigurationEdit;
