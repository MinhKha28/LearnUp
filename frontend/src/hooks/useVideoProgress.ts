import { useCallback, useEffect, useRef, useState } from "react";
import { reportVideoProgress } from "@/services/learning.service";
import { ApiError } from "@/types/api.types";
import type { VideoPlayback, VideoProgress } from "@/types/learning.types";
import {
  acknowledgeSegments,
  closeSegment,
  createSegments,
  openSegment,
  pendingSegments,
  updateSegment,
} from "@/utils/video.segments";
import { applyVideoProgress, videoOutcome } from "@/utils/video.outcome";
import {
  chooseVideoPosition,
  VIDEO_POSITION_SESSION_PREFIX,
  videoResumePosition,
  type VideoPosition,
} from "@/utils/video.position";

export function useVideoProgress(
  enrollmentId: string,
  playback: VideoPlayback,
) {
  const video = useRef<HTMLVideoElement | null>(null);
  const detachedMedia = useRef<{ time: number; seeking: boolean } | null>(null);
  const videoRef = useCallback((element: HTMLVideoElement | null) => {
    if (!element && video.current)
      detachedMedia.current = {
        time: video.current.currentTime,
        seeking: video.current.seeking,
      };
    video.current = element;
  }, []);
  const segments = useRef(createSegments());
  const [progress, setProgress] = useState<VideoProgress>(playback);
  const [warning, setWarning] = useState<string | null>(null);
  const mounted = useRef(false);
  const interacted = useRef(false);
  const restoring = useRef(false);
  const sessionActive = useRef(true);
  const lastReportTime = useRef(0);
  const pending = useRef<Promise<void> | null>(null);
  const cacheEnabled =
    import.meta.env.VITE_VIDEO_POSITION_SESSION_CACHE !== "0";
  const cacheKey =
    VIDEO_POSITION_SESSION_PREFIX +
    playback.learnerId +
    ":" +
    playback.materialId;

  const send = useCallback(
    async (
      keepalive = false,
      positionOnly = false,
      ended = false,
    ): Promise<void> => {
      const element = video.current;
      const media = element
        ? { time: element.currentTime, seeking: element.seeking }
        : detachedMedia.current;
      if (!media || !interacted.current || !sessionActive.current) return;
      const timestamp = Math.max(Date.now(), lastReportTime.current + 1);
      lastReportTime.current = timestamp;
      const position = {
        positionSeconds: ended
          ? playback.durationSeconds
          : Math.floor(media.time),
        reportedAt: new Date(timestamp).toISOString(),
      };
      if (cacheEnabled) {
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(position));
        } catch {
          /* Storage bị chặn không ngăn báo cáo lên server. */
        }
      }
      if (!media.seeking && segments.current.start !== null)
        segments.current = updateSegment(segments.current, media.time);
      if (pending.current && !keepalive) await pending.current;
      if (!sessionActive.current) return;
      const ranges = positionOnly ? [] : pendingSegments(segments.current);
      const work = reportVideoProgress(
        enrollmentId,
        playback.materialId,
        { ...position, ranges },
        keepalive,
      )
        .then((state) => {
          segments.current = acknowledgeSegments(segments.current, ranges);
          if (mounted.current) {
            setProgress((current) => applyVideoProgress(current, state));
            setWarning(null);
          }
          window.dispatchEvent(new Event("learning-progress"));
        })
        .catch((error: unknown) => {
          if (mounted.current)
            setWarning(
              videoOutcome(
                error instanceof ApiError
                  ? error
                  : new ApiError(0, "NETWORK", ""),
              ),
            );
        })
        .finally(() => {
          if (pending.current === work) pending.current = null;
        });
      pending.current = work;
      await work;
    },
    [
      enrollmentId,
      playback.materialId,
      playback.durationSeconds,
      cacheEnabled,
      cacheKey,
    ],
  );

  useEffect(() => {
    mounted.current = true;
    const interval = window.setInterval(() => {
      void send();
    }, playback.heartbeatSeconds * 1000);
    const hidden = () => {
      if (document.visibilityState === "hidden") void send(true);
    };
    const pagehide = () => {
      void send(true, true);
    };
    const signedOut = () => {
      sessionActive.current = false;
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", pagehide);
    window.addEventListener("auth-cleared", signedOut);
    return () => {
      mounted.current = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", pagehide);
      window.removeEventListener("auth-cleared", signedOut);
      void send(true);
    };
  }, [send, playback.heartbeatSeconds]);
  const close = (ended = false) => {
    const element = video.current;
    if (element && !element.seeking)
      segments.current = updateSegment(segments.current, element.currentTime);
    segments.current = closeSegment(segments.current);
    void send(false, false, ended);
  };
  return {
    video,
    videoRef,
    progress,
    warning,
    flush: () => send(),
    events: {
      onPlaying: () => {
        if (video.current) {
          interacted.current = true;
          segments.current = openSegment(
            segments.current,
            video.current.currentTime,
          );
        }
      },
      onTimeUpdate: () => {
        if (video.current && !video.current.seeking)
          segments.current = updateSegment(
            segments.current,
            video.current.currentTime,
          );
      },
      onSeeking: () => {
        if (!restoring.current) interacted.current = true;
        segments.current = closeSegment(segments.current);
      },
      onSeeked: () => {
        if (restoring.current) {
          restoring.current = false;
          return;
        }
        if (video.current && !video.current.paused)
          segments.current = openSegment(
            segments.current,
            video.current.currentTime,
          );
        void send();
      },
      onPause: () => close(),
      onEnded: () => close(true),
      onLoadedMetadata: () => {
        let session: VideoPosition | null = null;
        if (cacheEnabled) {
          try {
            session = JSON.parse(
              sessionStorage.getItem(cacheKey) ?? "null",
            ) as VideoPosition | null;
          } catch {
            /* Bản lưu hỏng hoặc storage bị chặn: dùng server. */
          }
        }
        const candidate = chooseVideoPosition(
          {
            positionSeconds: playback.positionSeconds,
            reportedAt: playback.positionReportedAt,
          },
          session,
        );
        const position = videoResumePosition(
          candidate.positionSeconds,
          playback.durationSeconds,
        );
        if (video.current && position !== video.current.currentTime) {
          restoring.current = true;
          video.current.currentTime = position;
        }
      },
    },
  };
}
