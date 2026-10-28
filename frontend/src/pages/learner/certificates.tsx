import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getCertificates,
  certificateDate,
} from "@/services/achievement.service";
import type { CertificateListItem } from "@/types/achievement.types";
import { ApiError } from "@/types/api.types";
import { useCertificateDownload } from "@/hooks/use.certificate.download";
import {
  LearnerButton,
  LearnerPage,
  PageHeader,
  StatusTag,
} from "@/components/learner/learner.ui";
import {
  LearnerSkeleton,
  LearnerEmptyState,
  LearnerErrorState,
} from "@/components/learner/learner.states";
import "./certificates.scss";
const Certificates = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<CertificateListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [initial, setInitial] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const pending = useRef<AbortController | null>(null);
  const downloads = useCertificateDownload();
  const load = useCallback(async (next?: string) => {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true);
    setError(null);
    try {
      const page = await getCertificates(next, controller.signal);
      if (controller.signal.aborted) return;
      setItems((previous) =>
        next ? [...previous, ...page.items] : page.items,
      );
      setCursor(page.nextCursor);
      setInitial(false);
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(
          cause instanceof ApiError ? cause : new ApiError(0, "NETWORK", ""),
        );
    } finally {
      if (pending.current === controller) pending.current = null;
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    return () => {
      pending.current?.abort();
      pending.current = null;
    };
  }, [load]);
  return (
    <LearnerPage className="learner-certificates">
      <PageHeader
        title="Chứng chỉ của tôi"
        subtitle="Chứng chỉ đã cấp cho các khóa học đã hoàn thành."
      />
      {initial && loading ? <LearnerSkeleton variant="list" /> : null}
      {error && (
        <LearnerErrorState
          error={error}
          onRetry={() => void load(initial ? undefined : (cursor ?? undefined))}
        />
      )}
      {!initial && items.length === 0 && (
        <LearnerEmptyState
          title="Chưa có chứng chỉ"
          description="Hoàn thành các điều kiện của khóa học để nhận chứng chỉ."
          action={
            <LearnerButton onClick={() => navigate("/learner/courses")}>
              Xem khóa học của tôi
            </LearnerButton>
          }
        />
      )}
      {items.length > 0 && (
        <>
          <div className="learner-certificates-card">
            <div className="learner-certificates-columns" aria-hidden="true">
              <span>Khóa học</span>
              <span>Phiên bản</span>
              <span>Ngày cấp</span>
              <span>Hoàn thành</span>
              <span>Thao tác</span>
            </div>
            <div className="learner-certificates-items">
              {items.map((item) => (
                <article
                  className="learner-certificate-item"
                  key={item.id}
                  aria-label={item.courseTitle}
                >
                  <h2 className="learner-certificate-course">
                    {item.courseTitle}
                  </h2>
                  <div className="learner-certificate-meta">
                    <span>Phiên bản</span>
                    <strong>{item.versionNumber}</strong>
                  </div>
                  <div className="learner-certificate-meta">
                    <span>Ngày cấp</span>
                    <strong>{certificateDate(item.issuedDate)}</strong>
                  </div>
                  <div className="learner-certificate-status">
                    <StatusTag
                      tone={item.completedLate ? "warning" : "success"}
                    >
                      {item.completedLate
                        ? "Hoàn thành sau hạn"
                        : "Hoàn thành đúng hạn"}
                    </StatusTag>
                  </div>
                  <div className="learner-certificate-controls">
                    <div className="learner-certificates-actions">
                      <LearnerButton
                        onClick={() =>
                          navigate("/learner/certificates/" + item.id)
                        }
                      >
                        Xem chi tiết
                      </LearnerButton>
                      <LearnerButton
                        loading={downloads.busy.has(item.id)}
                        disabled={downloads.busy.has(item.id)}
                        onClick={() => void downloads.download(item.id)}
                      >
                        Tải PDF
                      </LearnerButton>
                    </div>
                    {downloads.messages[item.id] && (
                      <p role="status">{downloads.messages[item.id]}</p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
          {cursor && (
            <LearnerButton
              loading={loading}
              disabled={loading}
              onClick={() => void load(cursor)}
            >
              Xem thêm
            </LearnerButton>
          )}
        </>
      )}
    </LearnerPage>
  );
};
export default Certificates;
