import { Alert, Button, Space, Tag } from "antd";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useCurrentApp } from "@/components/context/app.context";
import { useApiQuery } from "@/hooks/use.api.query";
import {
  notifyLearningProgress,
  useLearningRefresh,
} from "@/hooks/use.learning.refresh";
import {
  completeReading,
  fetchCurriculum,
  fetchReadingAccess,
} from "@/services/learning.service";
import type { LessonMaterial, ReadingCompletion } from "@/types/learning.types";
import { LEARNER_ROUTES } from "@/utils/learner.routes";
import { ENROLLMENT_STATUS_LABELS } from "@/utils/learner.labels";
import "./reading.resource.scss";

export function ReadingResource({
  enrollmentId,
  lessonId,
  material,
}: {
  enrollmentId: string;
  lessonId: string;
  material: LessonMaterial;
}) {
  const { user } = useCurrentApp();
  const access = useApiQuery(
    (signal) => fetchReadingAccess(enrollmentId, material.materialId, signal),
    [enrollmentId, material.materialId],
  );
  const enrollment = useApiQuery(
    (signal) => fetchCurriculum(enrollmentId, signal),
    [enrollmentId],
    true,
  );
  useLearningRefresh(enrollment.reload, enrollmentId);
  const [result, setResult] = useState<ReadingCompletion | null>(null);
  const [sending, setSending] = useState(false);
  const busy = useRef(false);
  const [error, setError] = useState(false);
  const completed = material.completed || result?.completedAt != null;
  const status =
    result?.enrollmentStatus === "Completed"
      ? "Completed"
      : (enrollment.data?.status ?? result?.enrollmentStatus);
  const readonly = status === "Completed";
  const mark = async () => {
    if (busy.current || completed || readonly) return;
    busy.current = true;
    setSending(true);
    setError(false);
    try {
      const saved = await completeReading(enrollmentId, material.materialId, {
        userId: user?.id ?? "",
        organizationId: user?.organizationId ?? "",
      });
      setResult(saved);
      notifyLearningProgress(enrollmentId, saved.completionEvaluationPending);
    } catch {
      setError(true);
    } finally {
      busy.current = false;
      setSending(false);
    }
  };
  return (
    <section className="reading-resource">
      <Link to={LEARNER_ROUTES.lesson(enrollmentId, lessonId)}>Về Bài học</Link>
      <h1>{material.title}</h1>
      <Space wrap>
        <Tag color={completed ? "success" : "default"}>
          {completed ? "Đã hoàn thành" : "Chưa hoàn thành"}
        </Tag>
        {status && <Tag aria-label="Trạng thái Enrollment">{ENROLLMENT_STATUS_LABELS[status].label}</Tag>}
      </Space>
      {access.status === "loading" && (
        <p role="status">Đang lấy liên kết tài liệu…</p>
      )}
      {access.status === "error" && (
        <Alert
          type="warning"
          showIcon
          message="Chưa thể mở tài liệu."
          action={<Button onClick={access.reload}>Thử lại</Button>}
        />
      )}
      {access.status === "success" && (
        <>
          {access.data.fixture && (
            <Alert
              type="info"
              message="Tài liệu mẫu (fixture) dùng cho môi trường thử nghiệm."
            />
          )}
          <Button
            href={access.data.accessUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Mở tệp Reading
          </Button>
        </>
      )}
      <Button
        type="primary"
        loading={sending}
        disabled={completed || readonly}
        onClick={() => void mark()}
      >
        {completed ? "Đã hoàn thành" : "Đánh dấu đã hoàn thành"}
      </Button>
      {readonly && !completed && (
        <p>Enrollment đã hoàn thành; tiến trình học liệu được giữ nguyên.</p>
      )}
      {error && (
        <Alert
          role="alert"
          type="error"
          showIcon
          message="Chưa xác nhận được hoàn thành. Hãy bấm lại để kiểm tra và lưu."
        />
      )}
    </section>
  );
}
