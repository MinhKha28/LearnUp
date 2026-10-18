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
  rejectSegments,
  updateSegment,
} from "@/utils/video.segments";
import { applyVideoProgress, videoOutcome } from "@/utils/video.outcome";

export function useVideoProgress(
  enrollmentId: string,
  playback: VideoPlayback,
) {
  const video = useRef<HTMLVideoElement>(null);
  const segments = useRef(createSegments());
  const [progress, setProgress] = useState<VideoProgress>(playback);
  const [warning, setWarning] = useState<string | null>(null);
  const mounted = useRef(false);
  const pending = useRef<Promise<void> | null>(null);
  const send = useCallback(
    async (keepalive = false): Promise<void> => {
      if (pending.current && !keepalive) {
        await pending.current;
        return send(false);
      }
      const element = video.current;
      if (element && !element.seeking && segments.current.start !== null)
        segments.current = updateSegment(segments.current, element.currentTime);
      const ranges = pendingSegments(segments.current);
      if (!ranges.length) return;
      const work = reportVideoProgress(
        enrollmentId,
        playback.materialId,
        ranges,
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
          if (
            error instanceof ApiError &&
            error.code === "PROGRESS_RATE_EXCEEDED"
          ) {
            const state = error.details.details as VideoProgress | undefined;
            const current = video.current;
            segments.current = rejectSegments(
              current?.currentTime ?? 0,
              !!current && !current.paused,
            );
            if (mounted.current) {
              if (state)
                setProgress((current) => applyVideoProgress(current, state));
              setWarning(null);
            }
          } else if (mounted.current)
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
    [enrollmentId, playback.materialId],
  );
  useEffect(() => {
    mounted.current = true;
    const interval = window.setInterval(() => {
      void send();
    }, playback.heartbeatSeconds * 1000);
    const hidden = () => {
      if (document.visibilityState === "hidden") void send(true);
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      mounted.current = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", hidden);
      void send(true);
    };
  }, [send, playback.heartbeatSeconds]);
  const close = (flush: boolean) => {
    const element = video.current;
    if (element && !element.seeking)
      segments.current = updateSegment(segments.current, element.currentTime);
    segments.current = closeSegment(segments.current);
    if (flush) void send();
  };
  return {
    video,
    progress,
    warning,
    flush: send,
    events: {
      onPlaying: () => {
        if (video.current)
          segments.current = openSegment(
            segments.current,
            video.current.currentTime,
          );
      },
      onTimeUpdate: () => {
        if (video.current && !video.current.seeking)
          segments.current = updateSegment(
            segments.current,
            video.current.currentTime,
          );
      },
      onSeeking: () => {
        segments.current = closeSegment(segments.current);
      },
      onSeeked: () => {
        if (video.current && !video.current.paused)
          segments.current = openSegment(
            segments.current,
            video.current.currentTime,
          );
      },
      onPause: () => close(true),
      onEnded: () => close(true),
      onRateChange: () => {
        if (
          video.current &&
          video.current.playbackRate > playback.maxPlaybackRate
        )
          video.current.playbackRate = playback.maxPlaybackRate;
      },
      onLoadedMetadata: () => {
        if (
          video.current &&
          !playback.completed &&
          playback.watchedRanges[0]?.[0] === 0
        )
          video.current.currentTime = playback.watchedRanges[0][1];
      },
    },
  };
}
