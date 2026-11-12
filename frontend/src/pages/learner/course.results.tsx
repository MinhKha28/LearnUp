import { Alert } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import {
  LearnerEmptyState,
  LearnerSkeleton,
} from "@/components/learner/learner.states";
import {
  InfoPanel,
  LearnerButton,
  PageHeader,
  StatCard,
  StatusTag,
} from "@/components/learner/learner.ui";
import { LearningError } from "@/components/learner/learning.error";
import { useApiQuery } from "@/hooks/use.api.query";
import { fetchAssessmentResults } from "@/services/learning.service";
import {
  attemptsLine,
  formatResultScore,
  formatResultTime,
  gapText,
  kindLabel,
  requirementLabel,
  resultStatusView,
  resultTarget,
  scoreBar,
  summaryLine,
} from "@/utils/assessment.results";
import { LEARNER_ROUTES } from "@/utils/learner.routes";
import "./course.results.scss";

/** UC28.1 — the scores of the Quizzes and Assignments done in a Course, set against the passing scores. */
const CourseResults = () => {
  const { enrollmentId = "" } = useParams();
  const navigate = useNavigate();
  const query = useApiQuery(
    (signal) => fetchAssessmentResults(enrollmentId, signal),
    [enrollmentId],
  );

  if (query.status === "loading") return <LearnerSkeleton variant="detail" />;
  if (query.status === "error") {
    return (
      <LearningError
        error={query.error}
        context="curriculum"
        enrollmentId={enrollmentId}
        onRetry={query.reload}
      />
    );
  }

  const data = query.data;
  const header = (
    <PageHeader
      eyebrow="Khóa học / Kết quả"
      title="Kết quả bài đánh giá"
      subtitle="Điểm các bài trắc nghiệm và bài tập bạn đã làm, so với điểm đạt tối thiểu."
      back
    />
  );
  const toAssessments = () =>
    navigate(LEARNER_ROUTES.assessments(enrollmentId));

  if (data.state === "unavailable" || !data.items || !data.summary) {
    return (
      <>
        {header}
        <Alert
          type="warning"
          showIcon
          message="Chưa lấy được kết quả bài đánh giá"
          description="Hệ thống chấm bài tạm thời chưa trả lời. Điểm của bạn không bị mất, hãy thử lại sau ít phút."
        />
        <div className="course-results-actions">
          <LearnerButton type="primary" onClick={query.reload}>
            Thử lại
          </LearnerButton>
          <LearnerButton onClick={toAssessments}>
            Quay lại danh sách bài đánh giá
          </LearnerButton>
        </div>
      </>
    );
  }

  if (data.items.length === 0) {
    return (
      <>
        {header}
        <LearnerEmptyState
          title="Bạn chưa làm bài nào"
          description="Khi bạn làm bài trắc nghiệm hoặc nộp bài tập, điểm sẽ hiện ở đây."
          action={
            <LearnerButton onClick={toAssessments}>
              Đến danh sách bài đánh giá
            </LearnerButton>
          }
        />
      </>
    );
  }

  const { summary, items } = data;
  return (
    <>
      {header}
      <div className="course-learning-content">
        <p className="course-results-summary">{summaryLine(summary)}</p>
        <div className="course-results-stats">
          <StatCard label="Đã làm" value={String(summary.total)} />
          <StatCard label="Đạt" value={String(summary.passed)} />
          <StatCard label="Chưa đạt" value={String(summary.notPassed)} />
          <StatCard label="Chờ kết quả" value={String(summary.pending)} />
        </div>

        <div className="course-results-list">
          {items.map((item) => {
            const view = resultStatusView(item);
            const target = resultTarget(enrollmentId, item);
            const bar = scoreBar(item);
            const attempts = attemptsLine(item);
            return (
              <article
                className="course-results-item"
                key={item.assessmentId}
                aria-label={item.title}
              >
                <header>
                  <div>
                    <strong>{item.title}</strong>
                    <small>
                      {kindLabel(item)} · {requirementLabel(item)} · Hoạt động
                      gần nhất {formatResultTime(item.lastActivityAt)}
                    </small>
                  </div>
                  <span className="course-results-tags">
                    {item.disabled && (
                      <StatusTag tone="neutral">Đã vô hiệu hóa</StatusTag>
                    )}
                    <StatusTag tone={view.tone}>{view.label}</StatusTag>
                  </span>
                </header>
                <div className="course-results-score">
                  <span className="course-results-number">
                    {item.recordedScore === null
                      ? "-"
                      : formatResultScore(item.recordedScore)}
                    <small> / 100</small>
                  </span>
                  <span className="course-results-passing">
                    Điểm đạt: {formatResultScore(item.passingScore)}
                  </span>
                </div>
                <div
                  className="course-results-bar"
                  role="img"
                  aria-label={
                    item.recordedScore === null
                      ? `Chưa có điểm, điểm đạt ${formatResultScore(item.passingScore)}`
                      : `Điểm ${formatResultScore(item.recordedScore)}, điểm đạt ${formatResultScore(item.passingScore)}`
                  }
                >
                  <span
                    className={`course-results-fill course-results-fill-${view.tone}`}
                    style={{ width: `${bar.score}%` }}
                  />
                  <span
                    className="course-results-mark"
                    style={{ left: `${bar.passing}%` }}
                  />
                </div>
                <p className="course-results-gap">{gapText(item)}</p>
                {attempts && (
                  <p className="course-results-attempts">{attempts}</p>
                )}
                {item.disabled && (
                  <p className="course-results-attempts">
                    Bài này đã bị vô hiệu hóa: điểm vẫn được giữ nhưng không
                    tính vào điều kiện cấp chứng chỉ.
                  </p>
                )}
                <LearnerButton onClick={() => navigate(target.to)}>
                  {target.label}
                </LearnerButton>
              </article>
            );
          })}
        </div>

        <InfoPanel title="Cách tính điểm">
          Bài trắc nghiệm lấy điểm từ lượt có điểm cao nhất; bài tập lấy điểm của lần
          nộp gần nhất sau khi giảng viên chốt. Bài chưa có điểm là "chờ kết
          quả", không phải "chưa đạt".
        </InfoPanel>
        <div className="course-results-actions">
          <LearnerButton onClick={toAssessments}>
            Quay lại danh sách bài đánh giá
          </LearnerButton>
        </div>
      </div>
    </>
  );
};

export default CourseResults;
