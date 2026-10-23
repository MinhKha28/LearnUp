import { accessClaims } from "@/utils/auth.claims";
import { mergeSegments, type MediaRange } from "@/utils/video.segments";

export interface ProgressOwner { organizationId: string; userId: string }
export interface ProgressReport { ranges: MediaRange[]; positionSeconds: number; reportedAt: string }
export interface ProgressBatch { keys: string[]; report: ProgressReport }
type QueueStorage = Pick<Storage, "length" | "key" | "getItem" | "setItem" | "removeItem">;
export const PROGRESS_QUEUE_PREFIX = "learnup.video-progress:";

export const ownsProgress = (owner: ProgressOwner, token: string | null) => {
  const claims = accessClaims(token);
  return claims?.sub === owner.userId && claims.organizationId === owner.organizationId;
};

function validReport(value: unknown): value is ProgressReport {
  if (!value || typeof value !== "object") return false;
  const r = value as ProgressReport;
  return Number.isSafeInteger(r.positionSeconds) && r.positionSeconds >= 0
    && typeof r.reportedAt === "string" && Number.isFinite(Date.parse(r.reportedAt))
    && Array.isArray(r.ranges) && r.ranges.every(p => Array.isArray(p) && p.length === 2
      && p.every(Number.isFinite) && p[0] >= 0 && p[0] < p[1]);
}

/** Immutable records let tabs ACK exact batches without overwriting another producer. */
export function createProgressQueue(
  owner: ProgressOwner, enrollmentId: string, materialId: string,
  storage: () => QueueStorage = () => localStorage,
) {
  const prefix = PROGRESS_QUEUE_PREFIX
    + [owner.organizationId, owner.userId, enrollmentId, materialId].map(encodeURIComponent).join(":") + ":";
  const memory = new Map<string, ProgressReport>();
  const persisted = new Set<string>();
  const producer = Array.from(crypto.getRandomValues(new Uint32Array(4)), value => value.toString(16).padStart(8, "0")).join("");
  let sequence = 0;
  const read = () => {
    try {
      const s = storage();
      for (const key of persisted) if (s.getItem(key) === null) {
        memory.delete(key);
        persisted.delete(key);
      }
      for (let i = 0; i < s.length; i++) {
        const key = s.key(i);
        if (!key?.startsWith(prefix)) continue;
        try {
          const value: unknown = JSON.parse(s.getItem(key) ?? "null");
          if (validReport(value)) { memory.set(key, value); persisted.add(key); }
        } catch { /* A damaged record must not stop playback. */ }
      }
    } catch { /* Storage may be blocked; retain the in-memory queue. */ }
    return [...memory.entries()].sort((a, b) => Date.parse(a[1].reportedAt) - Date.parse(b[1].reportedAt));
  };
  return {
    position() {
      const entries = read();
      return entries.length ? entries[entries.length - 1][1] : null;
    },
    append(report: ProgressReport) {
      const chunks = Math.max(1, Math.ceil(report.ranges.length / 20));
      for (let i = 0; i < chunks; i++) {
        const value = { ...report, ranges: report.ranges.slice(i * 20, (i + 1) * 20) };
        const key = prefix + producer + ":" + sequence++;
        memory.set(key, value);
        try { storage().setItem(key, JSON.stringify(value)); persisted.add(key); } catch { /* Keep the memory copy. */ }
      }
    },
    batch(): ProgressBatch | null {
      const keys: string[] = [];
      let report: ProgressReport | null = null;
      for (const [key, value] of read()) {
        const ranges = mergeSegments([...(report?.ranges ?? []), ...value.ranges]);
        if (ranges.length > 20) break;
        keys.push(key);
        report = { ...value, ranges };
      }
      return report ? { keys, report } : null;
    },
    acknowledge(batch: ProgressBatch) {
      for (const key of batch.keys) {
        memory.delete(key);
        persisted.delete(key);
        try { storage().removeItem(key); } catch { /* ACK still removes the memory copy. */ }
      }
    },
    clear() {
      const keys = read().map(([key]) => key);
      for (const key of keys) {
        memory.delete(key);
        persisted.delete(key);
        try { storage().removeItem(key); } catch { /* Keep playback available. */ }
      }
    },
  };
}
