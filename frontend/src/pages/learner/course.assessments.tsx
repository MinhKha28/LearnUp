import { useEffect, useState } from "react";
import { Tooltip } from "antd";
import { LockOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { LearnerSkeleton } from "@/components/learner/learner.states";
import {
  InfoPanel,
  LearnerButton,
  PageHeader,
  StatusTag,
} from "@/components/learner/learner.ui";
import { LearningError } from "@/components/learner/learning.error";
import { LEARNER_ROUTES } from "@/utils/learner.routes";
import { useApiQuery } from "@/hooks/use.api.query";
import {
  assessmentErrorText,
  fetchLearnerAssessmentsAPI,
} from "@/services/assessment.service";
import { fetchCurriculum } from "@/services/learning.service";
import type {
  ILearnerAssessmentItem,
  ILearnerAssessmentList,
} from "@/types/assessment.types";
import "./course.assessments.scss";

const formatTime = (iso: string) => new Date(iso).toLocaleString("vi-VN");

const statusView = (item: ILearnerAssessmentItem) => {
  switch (item.status) {
    case "InProgress":
      return { label: "Đang làm", tone: "info" as const };
    case "AwaitingResult":
      return { label: "Chờ kết quả", tone: "warning" as const };
    case "Completed":
      return item.passed
        ? { label: "Đạt", tone: "success" as const }
        : { label: "Chưa đạt", tone: "error" as const };
    default:
      // BR-153: nothing submitted is "not completed", never "failed".
      return { label: "Chưa làm", tone: "neutral" as const };
  }
};

const CourseAssessments = () => {
  const { enrollmentId = "" } = useParams();
  const navigate = useNavigate();
  const curriculum = useApiQuery(
    (signal) => fetchCurriculum(enrollmentId, signal),
    [enrollmentId],
  );
  const courseId =
    curriculum.status === "success" ? curriculum.data.courseId : null;

  const [list, setList] = useState<ILearnerAssessmentList | null>(null);
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
        const res = await fetchLearnerAssessmentsAPI(courseId);
        if (!active) return;
        // The axios interceptor resolves HTTP errors too, so only res.data tells success apart.
        if (res.data) setList(res.data);
        else
          setErrorMessage(
            assessmentErrorText(res, "Không tải được danh sách bài đánh giá."),
          );
      } catch {
        if (active)
          setErrorMessage("Không kết nối được với máy chủ. Vui lòng thử lại.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [courseId, reloadKey]);

  if (curriculum.status === "loading")
    return <LearnerSkeleton variant="detail" />;
  if (curriculum.status === "error") {
    return (
      <LearningError
        error={curriculum.error}
        context="curriculum"
        enrollmentId={enrollmentId}
        onRetry={curriculum.reload}
      />
    );
  }

  const base = `/learner/courses/${encodeURIComponent(enrollmentId)}`;

  const action = (item: ILearnerAssessmentItem) => {
    const locked = item.attempts.lockedUntil !== null;
    if (item.kind === "QUIZ") {
      // UC29.1: the Quiz page shows the rules, the lock and the attempt to continue.
      const quizPath = `${base}/quizzes/${item.id}`;
      if (item.status === "InProgress") {
        return (
          <LearnerButton type="primary" onClick={() => navigate(quizPath)}>
            Tiếp tục làm bài
          </LearnerButton>
        );
      }
      if (list?.readOnly)
        return (
          <LearnerButton onClick={() => navigate(quizPath)}>Xem</LearnerButton>
        );
      if (locked) return <LearnerButton disabled>Đang tạm khóa</LearnerButton>;
      return item.status === "NotStarted" ? (
        <LearnerButton type="primary" onClick={() => navigate(quizPath)}>
          Bắt đầu làm bài
        </LearnerButton>
      ) : (
        <span className="course-assessments-actions">
          <LearnerButton onClick={() => navigate(`${quizPath}/history`)}>
            Lịch sử
          </LearnerButton>
          <LearnerButton onClick={() => navigate(quizPath)}>
            Làm lại
          </LearnerButton>
        </span>
      );
    }
    const submitted = item.status !== "NotStarted";
    // UC30.2: a graded Assignment shows its result.
    const graded = item.status === "Completed";
    if (list?.readOnly) {
      return graded ? (
        <LearnerButton
          onClick={() => navigate(`${base}/assignments/${item.id}/result`)}
        >
          Xem kết quả
        </LearnerButton>
      ) : (
        <LearnerButton
          onClick={() => navigate(`${base}/assignments/${item.id}/submit`)}
        >
          Xem
        </LearnerButton>
      );
    }
    if (locked) {
      return <LearnerButton disabled>Đang tạm khóa</LearnerButton>;
    }
    // UC30.1: there is no limit on resubmissions, so a submitted Assignment can always be replaced.
    if (submitted) {
      return (
        <span className="course-assessments-actions">
          {graded && (
            <LearnerButton
              onClick={() => navigate(`${base}/assignments/${item.id}/result`)}
            >
              Xem kết quả
            </LearnerButton>
          )}
          <LearnerButton
            onClick={() => navigate(`${base}/assignments/${item.id}/resubmit`)}
          >
            Nộp lại
          </LearnerButton>
        </span>
      );
    }
    return (
      <LearnerButton
        type="primary"
        onClick={() => navigate(`${base}/assignments/${item.id}/submit`)}
      >
        Bắt đầu làm bài
      </LearnerButton>
    );
  };

  return (
    <>
      <PageHeader
        eyebrow="Khóa học / Bài đánh giá"
        title="Bài đánh giá"
        subtitle="Các bài trắc nghiệm và bài tập của khóa học này."
        back
        actions={
          <LearnerButton
            onClick={() => navigate(LEARNER_ROUTES.results(enrollmentId))}
          >
            Xem kết quả
          </LearnerButton>
        }
      />
      <InfoPanel title="Cách ghi nhận kết quả">
        Bài trắc nghiệm lấy điểm của lượt làm cao nhất; bài tập lấy điểm của lần
        nộp gần nhất. Làm hoặc nộp nhiều lần liên tiếp thì bài đó tạm khóa một
        thời gian.
      </InfoPanel>
      {list?.readOnly && (
        <InfoPanel title="Khóa học đã hoàn thành">
          Khóa học này đã hoàn thành nên các bài đánh giá chỉ để xem.
        </InfoPanel>
      )}
      <div className="course-learning-content">
        <div className="course-assessments-table-card">
          {errorMessage ? (
            <div className="course-assessments-error">
              <strong>Không tải được danh sách bài đánh giá</strong>
              <p>{errorMessage}</p>
              <LearnerButton onClick={() => setReloadKey((key) => key + 1)}>
                Thử lại
              </LearnerButton>
            </div>
          ) : (
            <table className="course-assessments-table">
              <thead>
                <tr>
                  <th>Bài đánh giá</th>
                  <th>Yêu cầu</th>
                  <th>Điểm đạt</th>
                  <th>Trạng thái</th>
                  <th>Điểm</th>
                  <th>Lượt còn lại</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7}>Đang tải bài đánh giá...</td>
                  </tr>
                )}
                {!loading && list?.items.length === 0 && (
                  <tr>
                    <td colSpan={7}>Khóa học này chưa có bài đánh giá nào.</td>
                  </tr>
                )}
                {!loading &&
                  list?.items.map((item) => {
                    const view = statusView(item);
                    const locked = item.attempts.lockedUntil !== null;
                    return (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.title}</strong>
                          <small className="course-assessments-kind">
                            {item.kind === "QUIZ"
                              ? item.timeLimitMinutes
                                ? `Bài trắc nghiệm, ${item.timeLimitMinutes} phút`
                                : "Bài trắc nghiệm"
                              : item.expectedDurationMinutes
                                ? `Bài tập, khoảng ${item.expectedDurationMinutes} phút`
                                : "Bài tập"}
                          </small>
                        </td>
                        <td>
                          {item.isRequired ? "Bắt buộc" : "Không bắt buộc"}
                        </td>
                        <td>{item.passingScore}%</td>
                        <td>
                          <StatusTag tone={view.tone}>{view.label}</StatusTag>
                        </td>
                        <td>
                          {item.recordedScore === null
                            ? "-"
                            : `${item.recordedScore}%`}
                        </td>
                        <td>
                          {locked ? (
                            <Tooltip
                              title={`Bạn làm lại được từ ${formatTime(item.attempts.lockedUntil!)}`}
                            >
                              <span className="course-assessments-locked">
                                <LockOutlined /> Mở lại{" "}
                                {formatTime(item.attempts.lockedUntil!)}
                              </span>
                            </Tooltip>
                          ) : (
                            `${item.attempts.remainingAttempts}/${item.attempts.maxConsecutiveAttempts}`
                          )}
                        </td>
                        <td>{action(item)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
          <p className="course-assessments-footnote">
            Sau một số lần làm hoặc nộp liên tiếp, bài đánh giá tạm khóa vài giờ
            rồi mở lại và đếm lại từ đầu.
          </p>
        </div>
      </div>
    </>
  );
};

export default CourseAssessments;
