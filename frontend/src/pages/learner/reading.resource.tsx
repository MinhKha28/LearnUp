import { Button, Space, Tag } from "antd";
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
import { VietnameseAlert } from "@/components/vietnamese.controls";

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
  const [opening, setOpening] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const openReading = async () => {
    setOpening(true);
    setAccessError(null);
    try {
      const fresh = await fetchReadingAccess(enrollmentId, material.materialId);
      // Course currently delivers Reading as an attachment. A same-page download
      // preserves the lesson and avoids leaving an empty popup behind.
      const link = document.createElement('a');
      link.href = fresh.accessUrl;
      link.download = '';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      setAccessError('Chưa thể mở tài liệu. Vui lòng thử lại.');
    } finally {
      setOpening(false);
    }
  };
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
      <Link to={LEARNER_ROUTES.lesson(enrollmentId, lessonId)}>Về bài học</Link>
      <h1>{material.title}</h1>
      <Space wrap>
        <Tag color={completed ? "success" : "default"}>
          Tài liệu: {completed ? "Đã hoàn thành" : "Chưa hoàn thành"}
        </Tag>
        {status && <Tag>Khóa học: {ENROLLMENT_STATUS_LABELS[status].label}</Tag>}
      </Space>
      {accessError && <VietnameseAlert type="error" message={accessError} showIcon />}
      <Button loading={opening} onClick={() => void openReading()}>Mở tài liệu đọc</Button>
      <Button
        type="primary"
        loading={sending}
        disabled={completed || readonly}
        onClick={() => void mark()}
      >
        {completed ? "Đã hoàn thành" : "Đánh dấu đã hoàn thành"}
      </Button>
      {readonly && !completed && (
        <p>Bạn đã hoàn thành khóa học. Tiến độ học liệu được giữ nguyên.</p>
      )}
      {error && (
        <VietnameseAlert
          role="alert"
          type="error"
          showIcon
          message="Chưa xác nhận được hoàn thành. Hãy bấm lại để kiểm tra và lưu."
        />
      )}
    </section>
  );
}
