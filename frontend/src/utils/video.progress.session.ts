import type { VideoProgress } from "@/types/learning.types";
import { ApiError } from "@/types/api.types";
import { createProgressQueue, ownsProgress, type ProgressOwner, type ProgressReport } from "./video.progress.queue";
import { progressFailureAction } from "./video.progress.response";

export function createVideoProgressSession(options: {
  owner: ProgressOwner;
  queue: ReturnType<typeof createProgressQueue>;
  token: () => string | null;
  report: (report: ProgressReport, keepalive: boolean) => Promise<VideoProgress>;
  success: (progress: VideoProgress) => void;
  failure: (error: unknown) => void;
}) {
  let active = true, suspended = false;
  let requests = 0;
  let retry: ReturnType<typeof options.queue.batch> = null;
  const owns = () => {
    try { return active && ownsProgress(options.owner, options.token()); }
    catch { return false; }
  };
  const restoredPosition = owns() ? options.queue.position() : null;
  return {
    owns,
    position: () => {
      if (!owns()) return null;
      const current = options.queue.position();
      return current && (!restoredPosition || Date.parse(current.reportedAt) > Date.parse(restoredPosition.reportedAt))
        ? current : restoredPosition;
    },
    busy: () => requests > 0,
    stop() { active = false; },
    record(report: ProgressReport) { if (owns()) options.queue.append(report); },
    async flush(keepalive = false, positionOnly?: ProgressReport) {
      if (!owns() || suspended || (requests > 0 && !keepalive)) return;
      const batch = positionOnly ? { keys: [], report: { ...positionOnly, ranges: [] } }
        : retry ?? options.queue.batch();
      if (!batch) return;
      requests++;
      const work = options.report(batch.report, keepalive).then(state => {
        if (!owns()) return;
        options.queue.acknowledge(batch);
        if (retry === batch) retry = null;
        options.success(state);
      }).catch((error: unknown) => {
        if (!owns()) return;
        const action = progressFailureAction(error);
        if (action === "suspend") suspended = true;
        if (action === "delete") {
          options.queue.clear();
          retry = null;
          if (error instanceof ApiError && error.status === 422)
            console.warn("Video progress rejected (422), X-Correlation-ID:", error.details.correlationId ?? "unavailable");
        } else if (batch.keys.length) retry = batch;
        options.failure(error);
      }).finally(() => { requests--; });
      await work;
    },
  };
}
