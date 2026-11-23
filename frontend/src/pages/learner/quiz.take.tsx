import { formatPercentageVN } from "@/utils/number.format";
import { formatDateTimeVN } from "@/utils/helper";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal, Spin } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import {
  InfoPanel,
  LearnerButton,
  LearnerPage,
  PageHeader,
  StatCard,
  StatusTag,
  WarningPanel,
} from "@/components/learner/learner.ui";
import {
  assessmentErrorCode,
  fetchLearnerQuizAPI,
  fetchQuizAttemptAPI,
  saveQuizAnswerAPI,
  startQuizAttemptAPI,
  submitQuizAttemptAPI,
} from "@/services/assessment.service";
import type {
  ILearnerQuiz,
  IQuizAttemptInProgress,
  IQuizAttemptResult,
  IQuizAttemptView,
} from "@/types/assessment.types";
import {
  clockOffsetMs,
  formatCountdown,
  questionTypeLabel,
  QUIZ_STALE_CODES,
  quizErrorText,
  secondsLeft,
  selectionAfterClick,
} from "@/utils/quiz.take";
import "./quiz.take.scss";
import { VietnameseAlert } from "@/components/vietnamese.controls";

type SaveState = "idle" | "saving" | "saved" | "failed";

/** UC29.1 — take a Quiz: the rules, the attempt with the countdown and the saved choices, then the result. */
const QuizTake = () => {
  const { enrollmentId = "", quizId = "" } = useParams();
  const navigate = useNavigate();
  const base = `/learner/courses/${encodeURIComponent(enrollmentId)}`;

  const [quiz, setQuiz] = useState<ILearnerQuiz | null>(null);
  const [attempt, setAttempt] = useState<IQuizAttemptView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  // saves on their way, and the questions whose last save failed (they stay marked until a save of that question works)
  const [pendingSaves, setPendingSaves] = useState(0);
  const [unsaved, setUnsaved] = useState<string[]>([]);
  const [everSaved, setEverSaved] = useState(false);
  const [left, setLeft] = useState(0);

  const offsetRef = useRef(0);
  const finishingRef = useRef(false);
  // the saves of one question go to the server one after the other, so an old choice cannot arrive after a new one
  const queueRef = useRef(new Map<string, Promise<void>>());
  // what the server has for each question (the last save that worked), and the number of the newest click on it
  const savedRef = useRef(new Map<string, string[]>());
  const clickRef = useRef(new Map<string, number>());

  const saveState: SaveState =
    pendingSaves > 0
      ? "saving"
      : unsaved.length > 0
        ? "failed"
        : everSaved
          ? "saved"
          : "idle";

  const loadQuiz = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetchLearnerQuizAPI(quizId);
      // The axios interceptor resolves HTTP errors too, so only res.data tells success apart.
      if (res.data) setQuiz(res.data);
      else
        setLoadError(
          quizErrorText(
            assessmentErrorCode(res).code,
            "Không tải được bài trắc nghiệm.",
          ),
        );
    } catch {
      setLoadError("Không kết nối được với máy chủ. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  useEffect(() => {
    void loadQuiz();
  }, [loadQuiz]);

  const show = useCallback((view: IQuizAttemptView) => {
    if (view.status === "InProgress") {
      offsetRef.current = clockOffsetMs(view.serverNow, Date.now());
      setLeft(secondsLeft(view.deadlineAt, Date.now(), offsetRef.current));
    }
    finishingRef.current = false;
    // the view comes from the server, so it is what the server has: nothing is waiting to be saved any more
    savedRef.current = new Map(
      view.status === "InProgress"
        ? view.questions.map((q) => [q.id, q.selectedOptionIds])
        : [],
    );
    clickRef.current = new Map();
    setUnsaved([]);
    setAttempt(view);
  }, []);

  /** Asks the server for the attempt as it is now: after the time ran out, or after an answer that says the page is old. */
  const reload = useCallback(
    async (attemptId: string): Promise<boolean> => {
      try {
        const res = await fetchQuizAttemptAPI(attemptId);
        if (res.data) {
          show(res.data);
          return true;
        }
        setNotice(
          quizErrorText(
            assessmentErrorCode(res).code,
            "Không tải được lượt làm bài.",
          ),
        );
      } catch {
        setNotice("Không kết nối được với máy chủ. Vui lòng thử lại.");
      }
      return false;
    },
    [show],
  );

  // The countdown: the deadline is the server's. At zero the attempt is read again, which makes the server submit it
  // with the answers saved (BR-200); if the server's clock is a little behind, it tries again in two seconds.
  const running = attempt?.status === "InProgress" ? attempt : null;
  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const seconds = secondsLeft(
        running.deadlineAt,
        Date.now(),
        offsetRef.current,
      );
      setLeft(seconds);
      if (seconds > 0 || finishingRef.current) return;
      finishingRef.current = true;
      setConfirmOpen(false);
      setNotice(
        "Đã hết thời gian. Bài được nộp tự động với các câu bạn đã trả lời.",
      );
      void reload(running.attemptId).then((ok) => {
        if (!ok) finishingRef.current = false;
      });
    };
    const timer = window.setInterval(tick, 1000);
    tick();
    return () => window.clearInterval(timer);
  }, [running?.attemptId, running?.deadlineAt, reload]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    setBusy(true);
    setNotice("");
    try {
      const res = await startQuizAttemptAPI(quizId);
      if (res.data) show(res.data);
      else {
        setNotice(
          quizErrorText(
            assessmentErrorCode(res).code,
            "Không bắt đầu được lượt làm bài.",
          ),
        );
        await loadQuiz();
      }
    } catch {
      setNotice("Không kết nối được với máy chủ. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  };

  /** Puts a choice on the screen, whatever the attempt looks like by now (a save can end after a newer click). */
  const showSelection = (questionId: string, ids: string[]) =>
    setAttempt((current) =>
      current && current.status === "InProgress"
        ? {
            ...current,
            questions: current.questions.map((q) =>
              q.id === questionId ? { ...q, selectedOptionIds: ids } : q,
            ),
          }
        : current,
    );

  const choose = (
    view: IQuizAttemptInProgress,
    questionId: string,
    optionId: string,
  ) => {
    const question = view.questions.find((q) => q.id === questionId);
    if (!question) return;
    const next = selectionAfterClick(
      question.type,
      question.selectedOptionIds,
      optionId,
    );
    if (next === question.selectedOptionIds) return;
    const click = (clickRef.current.get(questionId) ?? 0) + 1;
    clickRef.current.set(questionId, click);
    setNotice("");
    showSelection(questionId, next);
    setPendingSaves((n) => n + 1);
    const previous = queueRef.current.get(questionId) ?? Promise.resolve();
    const job = previous.then(async () => {
      let code: string | undefined;
      let offline = false;
      try {
        const res = await saveQuizAnswerAPI(view.attemptId, questionId, next);
        if (res.data) {
          savedRef.current.set(questionId, next);
          setPendingSaves((n) => n - 1);
          setEverSaved(true);
          // an older click that worked does not clear the mark of a newer click that is still on its way
          if (clickRef.current.get(questionId) === click)
            setUnsaved((ids) => ids.filter((id) => id !== questionId));
          return;
        }
        code = assessmentErrorCode(res).code;
      } catch {
        offline = true;
      }
      setPendingSaves((n) => n - 1);
      // The choice did not reach the server, so the page must not keep showing it as the answer: it goes back to what the
      // server has and the question stays marked, until a save of this question works. A newer click on the same
      // question carries its own choice, so only the newest one puts the question back.
      if (clickRef.current.get(questionId) === click) {
        showSelection(questionId, savedRef.current.get(questionId) ?? []);
        setUnsaved((ids) =>
          ids.includes(questionId) ? ids : [...ids, questionId],
        );
      }
      setNotice(
        offline
          ? "Chưa lưu được câu trả lời vì mất kết nối. Hãy chọn lại khi có mạng."
          : quizErrorText(code, "Chưa lưu được câu trả lời. Hãy chọn lại."),
      );
      if (code && QUIZ_STALE_CODES.includes(code)) await reload(view.attemptId);
    });
    queueRef.current.set(questionId, job);
  };

  const submit = async (view: IQuizAttemptInProgress) => {
    setBusy(true);
    try {
      await Promise.all([...queueRef.current.values()]);
      const res = await submitQuizAttemptAPI(view.attemptId);
      setConfirmOpen(false);
      if (res.data) show(res.data);
      else {
        const { code } = assessmentErrorCode(res);
        setNotice(quizErrorText(code, "Không nộp được bài. Vui lòng thử lại."));
        if (code === "ENROLLMENT_NOT_ACTIVE") setAttempt(null);
      }
    } catch {
      setNotice(
        "Không kết nối được với máy chủ. Bài của bạn vẫn được lưu, hãy nộp lại.",
      );
    } finally {
      setBusy(false);
    }
  };

  const answered = useMemo(
    () =>
      running
        ? running.questions.filter((q) => q.selectedOptionIds.length > 0).length
        : 0,
    [running],
  );

  // "Câu 2, 5" for the questions whose answer is not on the server, in the order of the page
  const unsavedLabel = useMemo(() => {
    if (!running || unsaved.length === 0) return "";
    const numbers = running.questions
      .map((q, index) => (unsaved.includes(q.id) ? index + 1 : 0))
      .filter(Boolean);
    return numbers.length === 0 ? "" : `Câu ${numbers.join(", ")}`;
  }, [running, unsaved]);

  const backToCourse = () => navigate(`${base}/assessments`);
  const toHistory = () => navigate(`${base}/quizzes/${quizId}/history`);
  const again = async () => {
    setAttempt(null);
    setNotice("");
    await loadQuiz();
  };

  if (loading && !quiz) {
    return (
      <LearnerPage className="quiz-take">
        <Spin />
      </LearnerPage>
    );
  }
  if (!quiz) {
    return (
      <LearnerPage className="quiz-take">
        <PageHeader
          eyebrow="Bài đánh giá / Bài trắc nghiệm"
          title="Bài trắc nghiệm"
          subtitle=""
          back
        />
        <VietnameseAlert
          type="error"
          showIcon
          message={loadError || "Không tìm thấy bài trắc nghiệm."}
        />
        <LearnerButton onClick={() => void loadQuiz()}>Thử lại</LearnerButton>
      </LearnerPage>
    );
  }

  // ------------------------------------------------------------------ the result
  if (attempt?.status === "Submitted") {
    return (
      <Result
        result={attempt}
        onHistory={toHistory}
        onCourse={backToCourse}
        onAgain={again}
        readOnly={quiz.readOnly}
        notice={notice}
      />
    );
  }

  // ------------------------------------------------------------------ the attempt
  if (running) {
    const low = left <= 60;
    return (
      <>
        <PageHeader
          eyebrow="Bài đánh giá / Bài trắc nghiệm"
          title={running.title}
          subtitle={`Lượt ${running.attemptNumber}. Mỗi lựa chọn được lưu ngay khi bạn chọn.`}
        />
        <div className="course-learning-content">
          <div
            className={`quiz-timer${low ? " quiz-timer-low" : ""}`}
            role="timer"
            aria-live="off"
          >
            <span>Thời gian còn lại</span>
            <strong>{formatCountdown(left)}</strong>
            <small>
              {saveState === "saving" && "Đang lưu..."}
              {saveState === "saved" && "Đã lưu"}
              {saveState === "failed" && "Chưa lưu được"}
            </small>
          </div>
          {notice && (
            <VietnameseAlert
              type={saveState === "failed" ? "error" : "warning"}
              showIcon
              message={notice}
            />
          )}
          {running.questions.map((question, index) => (
            <div className="quiz-question-card" key={question.id}>
              <div className="quiz-question-head">
                <span className="quiz-question-pill">Câu {index + 1}</span>
                <span className="quiz-question-type">
                  {questionTypeLabel(question.type)}
                </span>
              </div>
              <h3>{question.content}</h3>
              {unsaved.includes(question.id) && (
                <p className="quiz-question-unsaved" role="alert">
                  Đáp án của câu này chưa được lưu lên máy chủ. Hãy chọn lại.
                </p>
              )}
              <div className="quiz-options">
                {question.options.map((option) => {
                  const checked = question.selectedOptionIds.includes(
                    option.id,
                  );
                  return (
                    <button
                      type="button"
                      key={option.id}
                      className={`quiz-option${checked ? " selected" : ""}`}
                      aria-pressed={checked}
                      onClick={() => choose(running, question.id, option.id)}
                    >
                      <span
                        className={`quiz-option-marker quiz-option-marker-${
                          question.type === "MultipleChoice"
                            ? "checkbox"
                            : "radio"
                        }${checked ? " checked" : ""}`}
                      />
                      {option.content}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="quiz-footer">
            <div>
              <strong>
                Đã trả lời {answered}/{running.questions.length} câu
              </strong>
              <span>Hết giờ, bài được tự động nộp với các câu đã trả lời.</span>
              {unsavedLabel && (
                <span className="quiz-footer-unsaved">
                  {unsavedLabel} chưa được lưu. Hãy chọn lại đáp án.
                </span>
              )}
            </div>
            <LearnerButton type="primary" onClick={() => setConfirmOpen(true)}>
              Nộp bài
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
          <p className="quiz-modal-eyebrow">Bài trắc nghiệm</p>
          <h2>{running.title}</h2>
          <div className="quiz-modal-body">
            <h3>Nộp bài?</h3>
            <p className="quiz-modal-bold">
              Bài được chấm tự động ngay sau khi nộp và không sửa lại được.
            </p>
            <p>
              Bạn đã trả lời {answered} trên {running.questions.length} câu.
              {answered < running.questions.length &&
                " Câu chưa trả lời sẽ được tính là sai."}
            </p>
            {unsavedLabel && (
              <VietnameseAlert
                type="error"
                showIcon
                message={`${unsavedLabel} chưa được lưu lên máy chủ nên sẽ không được chấm. Bấm "Xem lại bài" để chọn lại đáp án.`}
              />
            )}
          </div>
          <div className="quiz-modal-actions">
            <LearnerButton onClick={() => setConfirmOpen(false)}>
              Xem lại bài
            </LearnerButton>
            <LearnerButton
              type="primary"
              loading={busy}
              onClick={() => void submit(running)}
            >
              Nộp bài
            </LearnerButton>
          </div>
        </Modal>
      </>
    );
  }

  // ------------------------------------------------------------------ before starting
  const locked = quiz.attempts.lockedUntil !== null;
  const canStart =
    !quiz.readOnly &&
    !locked &&
    quiz.questionCount > 0 &&
    quiz.timeLimitMinutes !== null;
  const resume = quiz.inProgressAttemptId !== null;
  return (
    <>
      <PageHeader
        eyebrow="Bài đánh giá / Bài trắc nghiệm"
        title={quiz.title}
        subtitle={
          quiz.isRequired
            ? "Bài trắc nghiệm bắt buộc."
            : "Bài trắc nghiệm không bắt buộc."
        }
        back
      />
      <div className="course-learning-content">
        {notice && <VietnameseAlert type="warning" showIcon message={notice} />}
        {locked && (
          <WarningPanel title="Bài trắc nghiệm đang tạm khóa">
            Bạn đã làm đủ {quiz.attempts.maxConsecutiveAttempts} lượt liên tiếp.
            Bạn làm lại được từ{" "}
            <strong>{formatDateTimeVN(quiz.attempts.lockedUntil!)}</strong>. Sau
            đó số lượt được đếm lại từ đầu, không giới hạn tổng số lượt.
          </WarningPanel>
        )}
        {quiz.readOnly && !resume && (
          <WarningPanel title="Khóa học đã hoàn thành">
            Bạn không thể bắt đầu lượt làm bài mới. Điểm của các lượt đã làm vẫn
            được giữ.
          </WarningPanel>
        )}
        <div className="quiz-result-stats">
          <StatCard label="Số câu hỏi" value={String(quiz.questionCount)} />
          <StatCard
            label="Thời gian làm bài"
            value={
              quiz.timeLimitMinutes ? `${quiz.timeLimitMinutes} phút` : "-"
            }
          />
          <StatCard
            label="Điểm đạt"
            value={`${formatPercentageVN(quiz.passingScore)}`}
          />
          <StatCard
            label="Số lượt còn lại trước khi tạm khóa"
            value={`${quiz.attempts.remainingAttempts}/${quiz.attempts.maxConsecutiveAttempts}`}
          />
        </div>
        {quiz.recordedScore !== null && (
          <InfoPanel title="Điểm hiện được ghi nhận">
            {formatPercentageVN(quiz.recordedScore)}, lấy từ lượt có điểm cao nhất.{" "}
            {quiz.passed
              ? "Bạn đã đạt."
              : "Bạn chưa đạt, có thể làm lại để cải thiện."}
          </InfoPanel>
        )}
        <InfoPanel title="Quy định làm bài">
          Đồng hồ chạy theo thời gian thực và không dừng khi bạn thoát khỏi màn
          hình hay mất kết nối. Hết giờ, bài được tự động nộp với các câu đã trả
          lời. Lượt làm bài được tính ngay khi bạn bắt đầu. Làm đủ{" "}
          {quiz.attempts.maxConsecutiveAttempts} lượt liên tiếp thì bài trắc nghiệm
          tạm khóa {quiz.attempts.lockoutHours} giờ, dù đã đạt hay chưa.
        </InfoPanel>
        <div className="quiz-footer">
          <div>
            <strong>
              {resume ? "Bạn đang có một lượt làm bài dở" : "Sẵn sàng làm bài?"}
            </strong>
            <span>
              {resume
                ? "Hãy tiếp tục, thời gian vẫn đang chạy."
                : "Thời gian bắt đầu tính khi bạn bấm nút."}
            </span>
          </div>
          <div className="quiz-result-actions">
            {quiz.submittedAttemptCount > 0 && (
              <LearnerButton onClick={toHistory}>Lịch sử làm bài</LearnerButton>
            )}
            <LearnerButton
              type="primary"
              loading={busy}
              disabled={!resume && !canStart}
              onClick={() => void start()}
            >
              {resume ? "Tiếp tục làm bài" : "Bắt đầu làm bài"}
            </LearnerButton>
          </div>
        </div>
      </div>
    </>
  );
};

const Result = ({
  result,
  onHistory,
  onCourse,
  onAgain,
  readOnly,
  notice,
}: {
  result: IQuizAttemptResult;
  onHistory: () => void;
  onCourse: () => void;
  onAgain: () => void;
  readOnly: boolean;
  notice: string;
}) => {
  const locked = result.attempts.lockedUntil !== null;
  const canTryAgain = !readOnly && !locked;
  return (
    <>
      <PageHeader
        eyebrow="Bài đánh giá / Bài trắc nghiệm"
        title="Kết quả bài trắc nghiệm"
        subtitle={`${result.title} • Chấm tự động`}
        back
      />
      <div className="course-learning-content">
        {result.submissionKind === "TimedOut" && (
          <VietnameseAlert
            type="warning"
            showIcon
            message="Hết giờ nên bài được nộp tự động với các câu bạn đã trả lời."
          />
        )}
        {notice && result.submissionKind !== "TimedOut" && (
          <VietnameseAlert type="info" showIcon message={notice} />
        )}
        <div className="quiz-result-card">
          <StatusTag tone={result.passed ? "success" : "warning"}>
            {result.passed ? "Đạt" : "Chưa đạt"}
          </StatusTag>
          <div className="quiz-result-stats">
            <StatCard label="Điểm lượt này" value={`${formatPercentageVN(result.score)}`} />
            <StatCard
              label="Điểm được ghi nhận"
              value={
                result.recordedScore === null
                  ? "-"
                  : `${formatPercentageVN(result.recordedScore)}`
              }
            />
            <StatCard
              label="Điểm đạt"
              value={`${formatPercentageVN(result.passingScore)}`}
            />
            <StatCard
              label="Số câu đúng"
              value={`${result.correctCount}/${result.totalQuestions}`}
            />
          </div>
          <InfoPanel title="Cách tính điểm">
            Điểm ghi nhận của bài trắc nghiệm là điểm của lượt có điểm cao nhất. Mỗi
            câu có điểm như nhau và chỉ đúng khi chọn đúng toàn bộ đáp án.
          </InfoPanel>
        </div>
        <div className="quiz-result-next">
          <h3>Tiếp theo</h3>
          {locked ? (
            <p>
              Bạn đã làm đủ {result.attempts.maxConsecutiveAttempts} lượt liên
              tiếp nên bài trắc nghiệm tạm khóa. Bạn làm lại được từ{" "}
              <strong>{formatDateTimeVN(result.attempts.lockedUntil!)}</strong>.
            </p>
          ) : (
            <p>
              Số lượt còn lại trước khi tạm khóa: {result.attempts.remainingAttempts}/{result.attempts.maxConsecutiveAttempts}.
            </p>
          )}
          <div className="quiz-result-actions">
            {canTryAgain && (
              <LearnerButton type="primary" onClick={onAgain}>
                Làm lại
              </LearnerButton>
            )}
            <LearnerButton onClick={onHistory}>Lịch sử làm bài</LearnerButton>
            <LearnerButton onClick={onCourse}>
              Quay lại danh sách bài đánh giá
            </LearnerButton>
          </div>
        </div>
      </div>
    </>
  );
};

export default QuizTake;
