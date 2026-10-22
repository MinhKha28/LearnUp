import { Alert, Button, Progress, Spin, Tag } from "antd";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApiQuery } from "@/hooks/use.api.query";
import { useVideoProgress } from "@/hooks/useVideoProgress";
import { fetchVideoPlayback } from "@/services/learning.service";
import type { VideoPlayback } from "@/types/learning.types";
import { videoThresholdPercent } from "@/utils/video.threshold";
import { videoOutcome } from "@/utils/video.outcome";
import "./lesson.resource.scss";

function VideoPlayer({
  playback,
  enrollmentId,
  lessonId,
}: {
  playback: VideoPlayback;
  enrollmentId: string;
  lessonId: string;
}) {
  const navigate = useNavigate();
  const { video, videoRef, progress, warning, events, flush } =
    useVideoProgress(enrollmentId, playback);
  const [rate, setRate] = useState(1);
  return (
    <section className="lesson-resource">
      <Button
        onClick={async () => {
          video.current?.pause();
          await flush();
          navigate(`/learner/courses/${enrollmentId}/lessons/${lessonId}`);
        }}
      >
        Về Bài học
      </Button>
      <h1>{playback.title}</h1>
      <video
        ref={videoRef}
        {...events}
        src={playback.playbackUrl}
        controls
        controlsList="noplaybackrate"
        preload="metadata"
        aria-label={playback.title}
      />
      <label>
        Tốc độ phát{" "}
        <select
          aria-label="Tốc độ phát"
          value={rate}
          onChange={(e) => {
            const value = Number(e.target.value);
            setRate(value);
            if (video.current) video.current.playbackRate = value;
          }}
        >
          {[0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 8, 16].map((r) => (
            <option key={r} value={r}>
              {r.toLocaleString("vi-VN")}×
            </option>
          ))}
        </select>
      </label>
      <div className="lesson-resource-progress">
        <Progress
          showInfo={false}
          percent={Math.min(
            100,
            Math.floor(
              (progress.watchedSeconds / progress.requiredSeconds) * 100,
            ),
          )}
          status={progress.completed ? "success" : "active"}
        />
        <span className="lesson-resource-target" aria-hidden="true" />
      </div>
      <div className="lesson-resource-summary" role="status">
        <Tag color={progress.completed ? "success" : "warning"}>
          {progress.completed ? "Đã hoàn thành" : "Chưa đủ thời lượng"}
        </Tag>
        <strong>Đã xem {progress.watchedSeconds} / {progress.requiredSeconds} giây cần
        thiết</strong>
        <span>Thời lượng video: {progress.durationSeconds} giây. Mốc cần đạt: {progress.requiredSeconds} giây (≈ {videoThresholdPercent(progress.durationSeconds, progress.requiredSeconds)}% thời lượng video).</span>
        <span>Mọi tốc độ phát đều được tính; không cộng trùng hoặc cộng khoảng tua qua.</span>
      </div>
      {warning && <Alert type="warning" message={warning} showIcon />}
      <p>
        Tiến độ được lưu mỗi {progress.heartbeatSeconds} giây.
      </p>
    </section>
  );
}
export default function LessonResource() {
  const { enrollmentId = "", lessonId = "", resourceId = "" } = useParams();
  const query = useApiQuery(
    (signal) => fetchVideoPlayback(enrollmentId, resourceId, signal),
    [enrollmentId, resourceId],
  );
  if (query.status === "loading") return <Spin aria-label="Đang tải Video" />;
  if (query.status === "error")
    return (
      <Alert
        type="error"
        message={videoOutcome(query.error)}
        action={<Button onClick={query.reload}>Thử lại</Button>}
      />
    );
  return (
    <VideoPlayer
      key={enrollmentId + resourceId}
      playback={query.data}
      enrollmentId={enrollmentId}
      lessonId={lessonId}
    />
  );
}
