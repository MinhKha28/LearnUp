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
import type { EnrollmentProgress } from "@/types/learning.types";
import { formatLocalDateTime } from "@/utils/helper";
import { ENROLLMENT_TYPE_LABELS } from "@/utils/learner.labels";
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
  reload,
}: {
  data: EnrollmentProgress;
  names: ReadonlyMap<string, string>;
  reload: () => void;
}) => {
  const { enrollment, materials = [], assessment, conditions } = data;
  const curriculum = useApiQuery(
    (signal) => fetchCurriculum(enrollment.id, signal),
    [enrollment.id],
  );
  const courseName = curriculum.status === "success" ? curriculum.data.course?.name : null;
  const base = LEARNER_ROUTES.curriculum(enrollment.id);
  const due =
    enrollment.enrollmentType === "Required" && enrollment.dueAt
      ? formatDueAt(enrollment.dueAt, enrollment.dueTimezone)
      : null;
  const assessmentName = (id: string, kind: string) =>
    names.get(id) || (kind === "quiz" ? "Bài kiểm tra" : "Bài tập");
  const completed = enrollment.status === "Completed";
  return (
    <>
      <header className="course-progress-heading">
        <Link to={base}>Về chương trình học</Link>
        <h1>Tiến độ hoàn thành Khóa học</h1>
        {courseName && <p className="course-progress-course-name">{courseName}</p>}
      </header>
      <section
        className="course-progress-summary"
        aria-label="Tình trạng hoàn thành"
      >
        <StatusTag tone={completed ? "success" : "info"}>
          {completed
            ? "Hoàn thành"
            : enrollment.status === "Overdue"
              ? "Quá hạn"
              : enrollment.status === "Exempted"
                ? "Được miễn học"
                : enrollment.status === "NotStarted"
                  ? "Chưa bắt đầu"
                  : "Đang học"}
        </StatusTag>
        <p>
          Loại phân công: {enrollment.enrollmentType === "Required"
            ? ENROLLMENT_TYPE_LABELS.Required
            : ENROLLMENT_TYPE_LABELS.Optional}
        </p>
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
              <Link to="/learner/certificates">Xem chứng chỉ</Link>
              <Link to={`${base}/evaluation`}>Đánh giá Khóa học</Link>
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
              <p>Chưa tải được thông tin bài kiểm tra/bài tập</p>
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
                  const material = materials.find(
                    (m) => m.materialId === item.id,
                  );
                  const label =
                    item.kind === "material"
                      ? material?.title || "Học liệu"
                      : item.kind === "peerReview"
                        ? `Hoàn thành chấm chéo: ${assessmentName(item.id, "assignment")}`
                        : `Đạt điểm yêu cầu: ${assessmentName(item.id, item.kind)}`;
                  return (
                    <li key={`${item.kind}:${item.id}`}>
                      <Link
                        to={
                          item.kind === "material" && material
                            ? LEARNER_ROUTES.lesson(
                                enrollment.id,
                                material.lessonId,
                              )
                            : `${base}/assessments`
                        }
                      >
                        {label}
                      </Link>
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
                  : "Các học liệu bắt buộc đã hoàn thành; thông tin bài kiểm tra/bài tập chưa có."}
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
              aria-label="Bài kiểm tra và bài tập"
            >
              <h2>Bài kiểm tra và bài tập</h2>
              {assessment.items.length === 0 ? (
                <p>Không có bài kiểm tra hoặc bài tập bắt buộc.</p>
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

const CourseProgress = () => {
  const { enrollmentId = "" } = useParams();
  const query = useApiQuery(
    (signal) => fetchEnrollmentProgress(enrollmentId, signal),
    [enrollmentId],
  );
  useLearningRefresh(query.reload, enrollmentId);
  const [names, setNames] = useState<{
    enrollmentId: string;
    items: Map<string, string>;
  } | null>(null);
  const data = query.status === "success" ? query.data : null;
  useEffect(() => {
    if (
      !data ||
      data.enrollment.status === "Completed" ||
      data.assessment?.state !== "ok"
    )
      return;
    let active = true;
    void (async () => {
      try {
        const res = await fetchLearnerAssessmentsAPI(data.enrollment.courseId);
        if (active)
          setNames({
            enrollmentId,
            items: new Map(
              (res.data?.items ?? []).map((item) => [item.id, item.title]),
            ),
          });
      } catch {
        if (active) setNames(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [data, enrollmentId]);
  return (
    <LearnerPage className="course-progress">
      {query.status === "loading" && <LearnerSkeleton variant="detail" />}
      {query.status === "error" && (
        <LearningError
          error={query.error}
          context="curriculum"
          enrollmentId={enrollmentId}
          onRetry={query.reload}
        />
      )}
      {data && (
        <ProgressDetails
          data={data}
          names={names?.enrollmentId === enrollmentId ? names.items : new Map()}
          reload={query.reload}
        />
      )}
    </LearnerPage>
  );
};

export default CourseProgress;
