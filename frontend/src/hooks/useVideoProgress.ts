import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchVideoPlayback, reportVideoProgress } from "@/services/learning.service";
import { refreshExpiringAccessToken } from "@/services/auth.session";
import { createProgressQueue, type ProgressReport } from "@/utils/video.progress.queue";
import { createVideoProgressSession } from "@/utils/video.progress.session";
import { ApiError } from "@/types/api.types";
import type { VideoPlayback, VideoProgress } from "@/types/learning.types";
import { useCurrentApp } from "@/components/context/app.context";
import {
  closeSegment,
  createSegments,
  openSegment,
  mergeSegments,
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
  const { user } = useCurrentApp();
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
  const [mediaError, setMediaError] = useState<string | null>(null);
  const expiresAt = useRef(playback.expiresAt);
  const swapping = useRef(false);
  const fetching = useRef(false);
  const failures = useRef(0);
  const healthyFrom = useRef<number | null>(null);
  const wantsPlay = useRef(false);
  const replacement = useRef<{ time: number; playing: boolean; rate: number } | null>(null);
  const accessAbort = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<VideoProgress>(playback);
  const [warning, setWarning] = useState<string | null>(null);
  const mounted = useRef(false);
  const interacted = useRef(false);
  const restoring = useRef(false);
  const lastReportTime = useRef(0);
  const lastCaptured = useRef<number | null>(null);
  const cacheEnabled =
    import.meta.env.VITE_VIDEO_POSITION_SESSION_CACHE !== "0";
  const cacheKey =
    VIDEO_POSITION_SESSION_PREFIX + user?.id + ":" + playback.materialId;

  const session = useMemo(() => {
    const owner = { userId: user?.id ?? "", organizationId: user?.organizationId ?? "" };
    return createVideoProgressSession({
      owner,
      queue: createProgressQueue(owner, enrollmentId, playback.materialId),
      token: () => localStorage.getItem("access_token"),
      report: (report, keepalive) => reportVideoProgress(enrollmentId, playback.materialId, report, keepalive, owner),
      success: state => {
        if (mounted.current) {
          setProgress(current => applyVideoProgress(current, state));
          setWarning(null);
        }
        window.dispatchEvent(new Event("learning-progress"));
      },
      failure: error => {
        if (mounted.current) setWarning(videoOutcome(error instanceof ApiError ? error : new ApiError(0, "NETWORK", "")));
      },
    });
  }, [user?.id, user?.organizationId, enrollmentId, playback.materialId]);

  const capture = useCallback(
    (ended = false): ProgressReport | undefined => {
      const element = video.current;
      const media = element
        ? { time: element.currentTime, seeking: element.seeking }
        : detachedMedia.current;
      if (swapping.current || !media || !interacted.current || !session.owns()) return;
      const positionSeconds = ended ? playback.durationSeconds : Math.floor(media.time);
      if (!media.seeking && segments.current.start !== null)
        segments.current = updateSegment(segments.current, media.time);
      if (positionSeconds === lastCaptured.current && !segments.current.closed.length) return;
      const timestamp = Math.max(Date.now(), lastReportTime.current + 1);
      lastReportTime.current = timestamp;
      const position = {
        positionSeconds,
        reportedAt: new Date(timestamp).toISOString(),
      };
      if (cacheEnabled && user?.id) {
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(position));
        } catch {
          /* Storage bị chặn không ngăn báo cáo lên server. */
        }
      }
      const current = segments.current;
      const ranges = mergeSegments([
        ...current.closed,
        ...(current.start !== null && current.lastTime > current.start
          ? [[current.start, current.lastTime] as [number, number]] : []),
      ]);
      const report = { ...position, ranges };
      session.record(report);
      lastCaptured.current = positionSeconds;
      /** BR-299: overlap the fractional boundary to preserve whole seconds after rounding. */
      segments.current = { ...current, closed: [], start: current.start === null ? null : Math.max(current.start, Math.floor(current.lastTime)) };
      return report;
    },
    [
      session,
      playback.durationSeconds,
      cacheEnabled,
      cacheKey,
      user?.id,
    ],
  );

  const send = useCallback(async (keepalive = false, positionOnly = false, ended = false) => {
    const report = capture(ended);
    const position = report ?? (lastCaptured.current === null ? undefined : {
      positionSeconds: lastCaptured.current, reportedAt: new Date(lastReportTime.current).toISOString(), ranges: [],
    });
    await session.flush(keepalive, positionOnly ? position : undefined);
  }, [capture, session]);

  const renew = useCallback(async (playing?: boolean) => {
    const element = video.current;
    if (!element || fetching.current) return;
    fetching.current = true;
    // Capture before load() resets currentTime. Keep the same durable queue and session.
    if (!swapping.current) {
      capture();
      segments.current = closeSegment(segments.current);
      replacement.current = { time: element.currentTime, playing: playing ?? (element.error ? wantsPlay.current : !element.paused), rate: element.playbackRate };
    } else if (replacement.current && playing !== undefined) {
      replacement.current.playing = playing;
    }
    swapping.current = true;
    element.pause();
    setMediaError(null);
    const controller = new AbortController();
    accessAbort.current = controller;
    try {
      const fresh = await fetchVideoPlayback(enrollmentId, playback.materialId, controller.signal);
      if (!mounted.current || controller.signal.aborted) return;
      expiresAt.current = fresh.expiresAt;
      // load() also handles a provider returning the same URL within one second.
      element.src = fresh.playbackUrl;
      element.load();
    } catch (error) {
      if (!controller.signal.aborted && mounted.current) {
        setMediaError(error instanceof ApiError ? videoOutcome(error) : 'Không tải được video. Vui lòng thử lại.');
      }
    } finally {
      fetching.current = false;
    }
  }, [capture, enrollmentId, playback.materialId]);
  const nearExpiry = () => Date.now() >= Date.parse(expiresAt.current) - 60_000;
  useEffect(() => {
    const visible = () => {
      if (document.visibilityState === 'visible' && nearExpiry()) void renew();
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      document.removeEventListener('visibilitychange', visible);
      accessAbort.current?.abort();
    };
  }, [renew]);

  useEffect(() => {
    mounted.current = true;
    const interval = window.setInterval(() => {
      void (async () => {
        if (!session.owns()) return;
        capture();
        if (session.busy()) return;
        if (!await refreshExpiringAccessToken()) return;
        await session.flush();
      })();
    }, playback.heartbeatSeconds * 1000);
    const hidden = () => {
      if (document.visibilityState === "hidden") void send(true);
    };
    const pagehide = () => {
      void send(true, true);
    };
    const signedOut = () => {
      session.stop();
    };
    const storageChanged = (event: StorageEvent) => {
      if (event.key === null || event.key === "access_token") {
        if (!session.owns()) session.stop();
      }
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", pagehide);
    window.addEventListener("auth-cleared", signedOut);
    window.addEventListener("storage", storageChanged);
    void session.flush();
    return () => {
      mounted.current = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", pagehide);
      window.removeEventListener("auth-cleared", signedOut);
      window.removeEventListener("storage", storageChanged);
      void send(true);
    };
  }, [send, capture, session, playback.heartbeatSeconds]);
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
    mediaError,
    retryMedia: () => { failures.current = 0; void renew(); },
    flush: () => send(),
    events: {
      onPlay: () => {
        wantsPlay.current = true;
        if (!swapping.current && nearExpiry()) void renew(true);
      },
      onError: () => {
        if (fetching.current) return;
        if (failures.current++ === 0) void renew();
        else {
          capture();
          segments.current = closeSegment(segments.current);
          setMediaError('Không tải được video. Vui lòng thử lại.');
        }
      },
      onPlaying: () => {
        if (video.current && !swapping.current) {
          interacted.current = true;
          healthyFrom.current = video.current.currentTime;
          segments.current = openSegment(
            segments.current,
            video.current.currentTime,
          );
        }
      },
      onTimeUpdate: () => {
        if (video.current && !video.current.seeking && !swapping.current) {
          if (!video.current.paused && healthyFrom.current !== null && video.current.currentTime > healthyFrom.current + 1) failures.current = 0;
          segments.current = updateSegment(
            segments.current,
            video.current.currentTime,
          );
          capture();
        }
      },
      onSeeking: () => {
        healthyFrom.current = null;
        if (swapping.current) return;
        if (!restoring.current) interacted.current = true;
        segments.current = closeSegment(segments.current);
      },
      onSeeked: () => {
        healthyFrom.current = video.current?.currentTime ?? null;
        if (swapping.current && replacement.current) {
          const saved = replacement.current;
          swapping.current = false;
          replacement.current = null;
          if (saved.playing && video.current) {
            segments.current = openSegment(segments.current, video.current.currentTime);
            void video.current.play().catch(() => setMediaError('Không tải được video. Vui lòng thử lại.'));
          }
          return;
        }
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
      onPause: () => {
        if (swapping.current || video.current?.error) return;
        wantsPlay.current = false;
        close();
      },
      onEnded: () => close(true),
      onLoadedMetadata: () => {
        if (replacement.current && video.current) {
          const element = video.current;
          const saved = replacement.current;
          element.playbackRate = saved.rate;
          const time = Math.min(saved.time, Number.isFinite(element.duration) ? element.duration : saved.time);
          if (Math.abs(time - element.currentTime) > 0.01) element.currentTime = time;
          else {
            swapping.current = false;
            replacement.current = null;
            if (saved.playing) void element.play().catch(() => setMediaError('Không tải được video. Vui lòng thử lại.'));
          }
          return;
        }
        let cached: VideoPosition | null = null;
        if (cacheEnabled && user?.id) {
          try {
            cached = JSON.parse(
              sessionStorage.getItem(cacheKey) ?? "null",
            ) as VideoPosition | null;
          } catch {
            /* Bản lưu hỏng hoặc storage bị chặn: dùng server. */
          }
        }
        const durable = session.position();
        const server = {
            positionSeconds: playback.positionSeconds,
            reportedAt: playback.positionReportedAt,
          };
        const candidate = chooseVideoPosition(
          durable && Date.parse(durable.reportedAt) > (Date.parse(server.reportedAt ?? "") || 0)
            ? durable : server,
          cached,
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
