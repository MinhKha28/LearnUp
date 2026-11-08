import { Alert, Button } from "antd";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { LearnerSkeleton } from "@/components/learner/learner.states";
import {
  LearnerButton,
  LearnerPage,
  StatusTag,
} from "@/components/learner/learner.ui";
import { LearningError } from "@/components/learner/learning.error";
import { useApiQuery } from "@/hooks/use.api.query";
import { useLearningRefresh } from "@/hooks/use.learning.refresh";
import { fetchCurriculum, fetchEnrollmentProgress } from "@/services/learning.service";
import { fetchLearnerAssessmentsAPI } from "@/services/assessment.service";
import { isRetryableError } from "@/types/api.types";
import type { EnrollmentProgress } from "@/types/learning.types";
import { formatLocalDateTime } from "@/utils/helper";
import { ENROLLMENT_STATUS_LABELS, ENROLLMENT_TYPE_LABELS } from "@/utils/learner.labels";
import { formatDueAt } from "@/utils/due.format";
import { LEARNER_ROUTES } from "@/utils/learner.routes";
import "./course.progress.scss";

const peerLabels = {
  NotApplicable: "Không áp dụng",
  Pending: "Chưa hoàn thành",
  Satisfied: "Đã hoàn thành",
  Missed: "Còn nghĩa vụ chấm chéo",
  Waived: "Được miễn",
};

const ProgressDetails = ({
  data,
  names,
  courseName,
  refreshFailed,
  reload,
}: {
  data: EnrollmentProgress;
  names: ReadonlyMap<string, string> | undefined;
  courseName: string | undefined;
  refreshFailed: boolean;
  reload: () => void;
}) => {
  const { enrollment, materials = [], assessment, conditions } = data;
  const base = LEARNER_ROUTES.curriculum(enrollment.id);
  const due =
    enrollment.enrollmentType === "Required" && enrollment.dueAt
      ? formatDueAt(enrollment.dueAt, enrollment.dueTimezone)
      : null;
  const assessmentName = (id: string, kind: string) =>
    names?.get(id) || (kind === "quiz" ? "Bài trắc nghiệm" : "Bài tập");
  const completed = enrollment.status === "Completed";
  const statusLabel = ENROLLMENT_STATUS_LABELS[enrollment.status];
  return (
    <>
      <header className="course-progress-heading">
        <Link to={base}>Về chương trình học</Link>
        <h1>Tiến độ hoàn thành Khóa học</h1>
        {courseName && <p className="course-progress-course-name">{courseName}</p>}
      </header>
      {refreshFailed && (
        <Alert
          className="course-progress-refresh-notice"
          type="warning"
          showIcon
          message="Chưa cập nhật được tiến độ mới nhất. Đang hiển thị dữ liệu lần tải trước."
          action={<Button size="small" onClick={reload}>Thử lại</Button>}
        />
      )}
      <section
        className="course-progress-summary"
        aria-label="Tình trạng hoàn thành"
      >
        <StatusTag tone={statusLabel.tone}>{statusLabel.label}</StatusTag>
        <p>Loại phân công: {ENROLLMENT_TYPE_LABELS[enrollment.enrollmentType]}</p>
        {due && (
          <p>
            Hạn hoàn thành: {due.text}
            {due.isDeviceTime && " (theo giờ thiết bị)"}
          </p>
        )}
        {completed ? (
          <>
            <p>
              Ngày hoàn thành:{" "}
              {enrollment.completedAt
                ? formatLocalDateTime(enrollment.completedAt)
                : "Chưa có thông tin"}
            </p>
            {enrollment.completedLate && <p>Hoàn thành sau hạn</p>}
            <nav
              className="course-progress-links"
              aria-label="Sau khi hoàn thành"
            >
              <Link to={LEARNER_ROUTES.certificates()}>Xem chứng chỉ</Link>
              <Link to={LEARNER_ROUTES.evaluation(enrollment.id)}>Đánh giá Khóa học</Link>
            </nav>
          </>
        ) : (
          conditions?.state === "ok" && (
            <p>
              Điều kiện hoàn thành: {conditions.met}/{conditions.total} đã đạt
            </p>
          )
        )}
      </section>
      {!completed && (
        <>
          {assessment?.state === "unavailable" && (
            <section className="course-progress-unavailable" role="alert">
              <p>Chưa tải được thông tin Bài trắc nghiệm và Bài tập</p>
              <LearnerButton onClick={reload}>Thử lại</LearnerButton>
            </section>
          )}
          <section
            className="course-progress-remains"
            aria-label="Điều kiện còn thiếu"
          >
            <h2>Điều kiện còn thiếu</h2>
            {conditions?.missing.length ? (
              <ul>
                {conditions.missing.map((item) => {
                  let label: string;
                  let target = `${base}/assessments`;
                  if (item.kind === "material") {
                    const material = materials.find((entry) => entry.materialId === item.id);
                    label = material
                      ? material.title || "Học liệu"
                      : "Một Học liệu bắt buộc khác (xem trong chương trình học)";
                    target = material
                      ? LEARNER_ROUTES.lesson(enrollment.id, material.lessonId)
                      : base;
                  } else if (item.kind === "peerReview") {
                    label = `Hoàn thành chấm chéo: ${assessmentName(item.id, "assignment")}`;
                  } else {
                    label = `Đạt điểm yêu cầu: ${assessmentName(item.id, item.kind)}`;
                  }
                  return (
                    <li key={`${item.kind}:${item.id}`}>
                      <Link to={target}>{label}</Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p>
                {assessment?.state === "ok"
                  ? conditions?.total === 0
                    ? "Khóa học chưa có điều kiện hoàn thành."
                    : "Đã đạt các điều kiện hiện có. Hệ thống đang ghi nhận kết quả hoàn thành."
                  : "Các học liệu bắt buộc đã hoàn thành. Chưa có thông tin về Bài trắc nghiệm và Bài tập."}
              </p>
            )}
          </section>
          <section className="course-progress-remains" aria-label="Học liệu">
            <h2>Học liệu</h2>
            <div className="course-progress-table-wrap">
              <table className="course-progress-table">
                <thead>
                  <tr>
                    <th>Học liệu</th>
                    <th>Yêu cầu</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((m) => (
                    <tr key={m.materialId}>
                      <td>
                        <Link
                          to={LEARNER_ROUTES.lesson(enrollment.id, m.lessonId)}
                        >
                          {m.title}
                        </Link>
                      </td>
                      <td>{m.required ? "Bắt buộc" : "Tự chọn"}</td>
                      <td>{m.done ? "Đã hoàn thành" : "Chưa hoàn thành"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {materials.length === 0 && <p>Khóa học chưa có học liệu.</p>}
          </section>
          {assessment?.state === "ok" && (
            <section
              className="course-progress-remains"
              aria-label="Bài trắc nghiệm và Bài tập"
            >
              <h2>Bài trắc nghiệm và Bài tập</h2>
              {assessment.items.length === 0 ? (
                <p>Không có Bài trắc nghiệm hoặc Bài tập bắt buộc.</p>
              ) : (
                <ul>
                  {assessment.items.map((item) => (
                    <li key={item.assessmentId}>
                      <Link to={`${base}/assessments`}>
                        {assessmentName(item.assessmentId, item.kind)}
                      </Link>
                      <span>
                        {" "}
                        —{" "}
                        {item.passed
                          ? "Đã đạt điểm yêu cầu"
                          : "Chưa đạt điểm yêu cầu"}
                      </span>
                      {item.peerReview &&
                        item.peerReview.status !== "NotApplicable" && (
                          <p>
                            Chấm chéo: {peerLabels[item.peerReview.status]} (
                            {item.peerReview.completedCount}/
                            {item.peerReview.requiredCount})
                          </p>
                        )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </>
  );
};

const EnrollmentProgressPage = ({ enrollmentId }: { enrollmentId: string }) => {
  const query = useApiQuery(
    (signal) => fetchEnrollmentProgress(enrollmentId, signal),
    [enrollmentId],
    true,
  );
  useLearningRefresh(query.reload, enrollmentId);
  const curriculum = useApiQuery(
    (signal) => fetchCurriculum(enrollmentId, signal),
    [enrollmentId],
  );
  const courseName = curriculum.status === "success" ? curriculum.data.course?.name : undefined;
  const [snapshot, setSnapshot] = useState<EnrollmentProgress | null>(null);
  const { status, data: queryData, error } = query;
  const retryableError = error !== null && isRetryableError(error);

  useEffect(() => {
    if (status === "success") setSnapshot(queryData);
    if (error && !retryableError) setSnapshot(null);
  }, [status, queryData, error, retryableError]);

  const data = queryData ?? (status === "loading" || retryableError ? snapshot : null);
  const courseId =
    data?.enrollment.status !== "Completed" && data?.assessment?.state === "ok"
      ? data.enrollment.courseId
      : undefined;
  const [names, setNames] = useState<{
    courseId: string;
    items: ReadonlyMap<string, string>;
  } | null>(null);

  useEffect(() => {
    if (!courseId) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetchLearnerAssessmentsAPI(courseId, controller.signal);
        if (!controller.signal.aborted) {
          setNames({
            courseId,
            items: new Map((res.data?.items ?? []).map((item) => [item.id, item.title])),
          });
        }
      } catch {
        if (!controller.signal.aborted) setNames(null);
      }
    })();
    return () => controller.abort();
  }, [courseId]);
  return (
    <LearnerPage className="course-progress">
      {status === "loading" && !data && <LearnerSkeleton variant="detail" />}
      {error && !data && (
        <LearningError
          error={error}
          context="curriculum"
          enrollmentId={enrollmentId}
          onRetry={query.reload}
        />
      )}
      {data && (
        <ProgressDetails
          data={data}
          names={names && names.courseId === courseId ? names.items : undefined}
          courseName={courseName}
          refreshFailed={retryableError}
          reload={query.reload}
        />
      )}
    </LearnerPage>
  );
};

const CourseProgress = () => {
  const { enrollmentId = "" } = useParams();
  return <EnrollmentProgressPage key={enrollmentId} enrollmentId={enrollmentId} />;
};

export default CourseProgress;
