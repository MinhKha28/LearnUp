import { Alert, Button, Progress, Spin, Tag } from "antd";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApiQuery } from "@/hooks/use.api.query";
import { useVideoProgress } from "@/hooks/useVideoProgress";
import { fetchVideoPlayback } from "@/services/learning.service";
import type { VideoPlayback } from "@/types/learning.types";
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
  const { video, progress, warning, events, flush } = useVideoProgress(
    enrollmentId,
    playback,
  );
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
        Về Lesson
      </Button>
      <h1>{playback.title}</h1>
      {progress.completed && <Tag color="success">Đã hoàn thành</Tag>}
      <video
        ref={video}
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
          {[0.5, 0.75, 1, 1.25, 1.5, 2]
            .filter((r) => r <= progress.maxPlaybackRate)
            .map((r) => (
              <option key={r} value={r}>
                {r.toLocaleString("vi-VN")}×
              </option>
            ))}
        </select>
      </label>
      <Progress
        percent={Math.min(
          100,
          Math.floor(
            (progress.watchedSeconds / progress.requiredSeconds) * 100,
          ),
        )}
        status={progress.completed ? "success" : "active"}
      />
      <p>
        Đã xem {progress.watchedSeconds} / {progress.requiredSeconds} giây cần
        thiết (Video {progress.durationSeconds} giây).
      </p>
      {warning && <Alert type="warning" message={warning} showIcon />}
      <p>
        Tiến độ được lưu mỗi {progress.heartbeatSeconds} giây. Không đổi Học
        viên trong proxy khi Video đang phát.
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
