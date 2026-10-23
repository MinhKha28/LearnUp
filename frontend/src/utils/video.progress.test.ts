import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/types/api.types";
import type { VideoProgress } from "@/types/learning.types";
import { createProgressQueue, ownsProgress, type ProgressReport } from "./video.progress.queue";
import { createVideoProgressSession } from "./video.progress.session";
import { progressFailureAction } from "./video.progress.response";
import { accessClaims } from "./auth.claims";

const owner = { organizationId: "synthetic-org", userId: "synthetic-a" };
const jwt = (sub = owner.userId) => `header.${btoa(JSON.stringify({ sub, organizationId: owner.organizationId, exp: 9_999_999_999 }))}.signature`;
const report = (end = 15, start = 0): ProgressReport => ({ ranges: [[start, end]], positionSeconds: end, reportedAt: new Date(1_000 * end).toISOString() });
function storage() {
  const map = new Map<string, string>();
  return { get length() { return map.size; }, key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value); },
    removeItem: (key: string) => { map.delete(key); }, map };
}
afterEach(() => vi.restoreAllMocks());

describe("durable video progress", () => {
  it("recovers after reload, keeps timestamps and ACKs only the sent batch", () => {
    const s = storage(), queue = createProgressQueue(owner, "e", "m", () => s);
    queue.append(report());
    const reopened = createProgressQueue(owner, "e", "m", () => s);
    const batch = reopened.batch()!;
    queue.append(report(30, 15));
    reopened.acknowledge(batch);
    expect(createProgressQueue(owner, "e", "m", () => s).batch()?.report).toEqual(report(30, 15));
    expect(batch.report.reportedAt).toBe(report().reportedAt);
  });
  it("isolates organization, user, enrollment and material without deleting another user's records", () => {
    const s = storage(), a = createProgressQueue(owner, "e", "m", () => s);
    a.append(report());
    for (const [who, e, m] of [[{ ...owner, userId: "b" }, "e", "m"], [{ ...owner, organizationId: "other" }, "e", "m"], [owner, "other", "m"], [owner, "e", "other"]] as const) {
      const other = createProgressQueue(who, e, m, () => s);
      expect(other.batch()).toBeNull(); other.clear();
    }
    expect(a.batch()?.report).toEqual(report());
    expect(ownsProgress(owner, jwt("b"))).toBe(false);
  });
  it("keeps two producers' new records when either tab ACKs the shared batch", () => {
    const s = storage(), a = createProgressQueue(owner, "e", "m", () => s), b = createProgressQueue(owner, "e", "m", () => s);
    a.append(report()); b.append(report(20, 10));
    const batch = a.batch()!;
    b.append(report(25, 20));
    a.acknowledge(batch);
    expect(createProgressQueue(owner, "e", "m", () => s).batch()?.report.ranges).toEqual([[20, 25]]);
  });
  it("limits reports to 20 disjoint ranges and retains the remainder", () => {
    const s = storage(), q = createProgressQueue(owner, "e", "m", () => s);
    for (let i = 0; i < 25; i++) q.append(report(i * 3 + 1, i * 3));
    const first = q.batch()!;
    expect(first.report.ranges).toHaveLength(20);
    q.acknowledge(first);
    expect(q.batch()?.report.ranges).toHaveLength(5);
  });
  it("ignores corrupt storage and continues in memory when storage is blocked", () => {
    const s = storage(), q = createProgressQueue(owner, "e", "m", () => s);
    q.append(report());
    s.map.set([...s.map.keys()][0], "{broken");
    expect(createProgressQueue(owner, "e", "m", () => s).batch()).toBeNull();
    const blocked = createProgressQueue(owner, "e", "m", () => { throw new Error("blocked"); });
    blocked.append(report());
    const batch = blocked.batch()!;
    expect(batch.report).toEqual(report());
    blocked.acknowledge(batch); expect(blocked.batch()).toBeNull();
  });
  it("treats JWT payloads as optional ownership hints", () => {
    expect(accessClaims("invalid")).toBeNull();
    expect(accessClaims(`a.${btoa('{"sub":"a","exp":"bad"}')}.b`)).toBeNull();
    expect(accessClaims(jwt())?.sub).toBe(owner.userId);
  });
});

describe("progress response policy", () => {
  it.each([[401, "UNAUTHORIZED"], [0, "TIMEOUT"], [0, "NETWORK"], [500, "HTTP_500"], [503, "PLAYBACK_UNAVAILABLE"], [429, "RATE_LIMITED"], [403, "OTHER"]])("retains %i %s", (status, code) => {
    expect(progressFailureAction(new ApiError(status, code, ""))).toBe("retain");
  });
  it.each([[404, "ENROLLMENT_NOT_FOUND"], [404, "MATERIAL_NOT_FOUND"], [409, "MATERIAL_NOT_VIDEO"], [422, "VALIDATION_ERROR"]])("deletes %i %s", (status, code) => {
    expect(progressFailureAction(new ApiError(status, code, ""))).toBe("delete");
  });
  it("suspends unavailable content", () => expect(progressFailureAction(new ApiError(403, "CONTENT_UNAVAILABLE", ""))).toBe("suspend"));
});

function fixture() {
  const s = storage(), queue = createProgressQueue(owner, "e", "m", () => s);
  let token = jwt();
  const send = vi.fn<(r: ProgressReport, keepalive: boolean) => Promise<VideoProgress>>().mockResolvedValue({ completed: true } as VideoProgress);
  const success = vi.fn(), failure = vi.fn();
  const create = () => createVideoProgressSession({ owner, queue, token: () => token, report: send, success, failure });
  return { queue, send, success, failure, create, setToken: (value: string) => { token = value; } };
}
describe("video session orchestration", () => {
  it("preserves a replayed bookmark until media metadata loads, even if the ACK arrives first", async () => {
    const f = fixture(); f.queue.append(report(105));
    const session = f.create();
    await session.flush();
    expect(f.queue.batch()).toBeNull();
    expect(session.position()?.positionSeconds).toBe(105);
  });
  it("skips empty heartbeats and ACKs a 200 even when Completed ignores ranges", async () => {
    const f = fixture(), session = f.create();
    await session.flush(); expect(f.send).not.toHaveBeenCalled();
    session.record(report()); await session.flush();
    expect(f.queue.batch()).toBeNull(); expect(f.success).toHaveBeenCalledOnce();
    await session.flush(); expect(f.send).toHaveBeenCalledTimes(1);
  });
  it("skips in-flight heartbeats while recording new segments durably", async () => {
    const f = fixture(), session = f.create();
    let resolve!: (state: VideoProgress) => void;
    f.send.mockReturnValueOnce(new Promise(r => { resolve = r; }));
    session.record(report()); const sending = session.flush();
    session.record(report(30, 15)); await session.flush();
    expect(f.send).toHaveBeenCalledTimes(1); expect(session.busy()).toBe(true);
    resolve({} as VideoProgress); await sending;
    expect(f.queue.batch()?.report).toEqual(report(30, 15));
  });
  it("retries the original batch and timestamp after a failure", async () => {
    const f = fixture(), session = f.create();
    f.send.mockRejectedValueOnce(new ApiError(0, "TIMEOUT", ""));
    session.record(report()); await session.flush();
    session.record(report(30, 15)); await session.flush();
    expect(f.send.mock.calls[1][0]).toEqual(report());
    expect(f.queue.batch()?.report).toEqual(report(30, 15));
  });
  it("keeps unavailable content until the video is reopened", async () => {
    const f = fixture(), session = f.create();
    f.send.mockRejectedValueOnce(new ApiError(403, "CONTENT_UNAVAILABLE", ""));
    session.record(report()); await session.flush(); await session.flush(true);
    expect(f.send).toHaveBeenCalledTimes(1); expect(f.queue.batch()).not.toBeNull();
    await f.create().flush(); expect(f.send).toHaveBeenCalledTimes(2);
  });
  it.each([[404, "ENROLLMENT_NOT_FOUND"], [404, "MATERIAL_NOT_FOUND"], [409, "MATERIAL_NOT_VIDEO"], [422, "VALIDATION_ERROR"]])("removes terminal %i %s and warns only for 422", async (status, code) => {
    const f = fixture(), session = f.create(), warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    f.send.mockRejectedValueOnce(new ApiError(status, code, "", { correlationId: "synthetic-correlation" }));
    session.record(report()); await session.flush();
    expect(f.queue.batch()).toBeNull();
    if (status === 422) expect(warn).toHaveBeenCalledWith(expect.any(String), "synthetic-correlation");
    else expect(warn).not.toHaveBeenCalled();
  });
  it("logout retains the queue and a different user cannot send or ACK it", async () => {
    const f = fixture(), session = f.create();
    session.record(report()); session.stop(); await session.flush(true);
    expect(f.send).not.toHaveBeenCalled();
    f.setToken(jwt("b")); await f.create().flush();
    expect(f.queue.batch()).not.toBeNull(); expect(f.send).not.toHaveBeenCalled();
    f.setToken(jwt()); await f.create().flush(); expect(f.queue.batch()).toBeNull();
  });
  it("does not ACK an old user's request after another tab changes identity", async () => {
    const f = fixture(), session = f.create();
    let resolve!: (state: VideoProgress) => void;
    f.send.mockReturnValueOnce(new Promise(r => { resolve = r; }));
    session.record(report()); const sending = session.flush();
    f.setToken(jwt("b")); resolve({} as VideoProgress); await sending;
    expect(f.queue.batch()).not.toBeNull(); expect(f.success).not.toHaveBeenCalled();
  });
  it("pagehide position-only does not ACK unsent coverage", async () => {
    const f = fixture(), session = f.create();
    session.record(report()); await session.flush(true, report());
    expect(f.send.mock.calls[0]).toEqual([{ ...report(), ranges: [] }, true]);
    expect(f.queue.batch()).not.toBeNull();
  });
});
