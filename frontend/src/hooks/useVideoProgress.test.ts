import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type {} from "@/types/axios";
const harness = vi.hoisted(() => ({ effects: [] as (() => void | (() => void))[], report: vi.fn(), refresh: vi.fn() }));
vi.mock("react", () => ({
  useRef: <T,>(current: T) => ({ current }),
  useState: <T,>(initial: T) => [initial, vi.fn()],
  useMemo: (factory: () => unknown) => factory(),
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => void | (() => void)) => { harness.effects.push(effect); },
}));
vi.mock("@/components/context/app.context", () => ({ useCurrentApp: () => ({ user: { id: "a", organizationId: "org" } }) }));
vi.mock("@/services/learning.service", () => ({ reportVideoProgress: (...args: unknown[]) => harness.report(...args) }));
vi.mock("@/services/auth.session", () => ({ refreshExpiringAccessToken: () => harness.refresh() }));
import { useVideoProgress } from "./useVideoProgress";
import type { VideoPlayback } from "@/types/learning.types";
import { createProgressQueue } from "@/utils/video.progress.queue";

const stored = new Map<string, string>();
const jwt = (sub = "a") => `h.${btoa(JSON.stringify({ sub, organizationId: "org", exp: 9_999_999_999 }))}.s`;
let cleanup: (() => void) | undefined;
beforeEach(() => {
  vi.useFakeTimers(); harness.effects.length = 0; stored.clear(); stored.set("access_token", jwt());
  harness.report.mockReset().mockResolvedValue({ watchedSeconds: 0, positionReportedAt: null });
  harness.refresh.mockReset().mockResolvedValue(true);
  vi.stubGlobal("localStorage", {
    get length() { return stored.size; }, key: (i: number) => [...stored.keys()][i] ?? null,
    getItem: (k: string) => stored.get(k) ?? null, setItem: (k: string, v: string) => { stored.set(k, v); }, removeItem: (k: string) => { stored.delete(k); },
  });
  vi.stubGlobal("sessionStorage", { getItem: () => null, setItem: vi.fn() });
  vi.stubGlobal("window", Object.assign(new EventTarget(), { setInterval, clearInterval }));
  vi.stubGlobal("document", Object.assign(new EventTarget(), { visibilityState: "visible" }));
});
afterEach(() => { cleanup?.(); cleanup = undefined; vi.useRealTimers(); vi.unstubAllGlobals(); });
function VideoHarness() {
  const hook = useVideoProgress("e", { materialId: "m", durationSeconds: 601, heartbeatSeconds: 15, positionSeconds: null, positionReportedAt: null } as VideoPlayback);
  const media = { currentTime: 0, seeking: false, paused: false };
  hook.videoRef(media as HTMLVideoElement);
  cleanup = harness.effects[0]() as () => void;
  return { hook, media };
}
it("records on timeupdate before any HTTP request and skips unchanged paused heartbeats", async () => {
  const { hook, media } = VideoHarness(); hook.events.onPlaying(); media.currentTime = 5.2; hook.events.onTimeUpdate();
  expect(createProgressQueue({ userId: "a", organizationId: "org" }, "e", "m").position()?.positionSeconds).toBe(5);
  expect(harness.report).not.toHaveBeenCalled();
  hook.events.onPause(); await vi.advanceTimersByTimeAsync(0);
  const calls = harness.report.mock.calls.length;
  await vi.advanceTimersByTimeAsync(30_000);
  expect(harness.report).toHaveBeenCalledTimes(calls);
});
it("does not bridge a seek and preserves fractional coverage across captures", async () => {
  const { hook, media } = VideoHarness(); hook.events.onPlaying();
  media.currentTime = 1.2; hook.events.onTimeUpdate();
  media.currentTime = 2.2; hook.events.onTimeUpdate();
  hook.events.onSeeking(); media.currentTime = 50; hook.events.onSeeked();
  await vi.advanceTimersByTimeAsync(0);
  expect(harness.report.mock.calls[0][2].ranges).toEqual([[0, 2.2]]);
  expect(harness.report.mock.calls[0][2].positionSeconds).toBe(50);
});
it("keeps accumulating during an in-flight request and skips proactive refresh for that heartbeat", async () => {
  harness.report.mockReturnValue(new Promise(() => {}));
  const { hook, media } = VideoHarness(); hook.events.onPlaying();
  media.currentTime = 5; hook.events.onPause();
  media.currentTime = 6; hook.events.onTimeUpdate();
  await vi.advanceTimersByTimeAsync(15_000);
  expect(harness.refresh).not.toHaveBeenCalled();
  expect(createProgressQueue({ userId: "a", organizationId: "org" }, "e", "m").position()?.positionSeconds).toBe(6);
});
it.each(["auth-cleared", "storage"])("stops cleanup sends after %s without deleting the owner's durable records", async event => {
  const { hook, media } = VideoHarness(); hook.events.onPlaying(); media.currentTime = 5; hook.events.onTimeUpdate();
  if (event === "storage") stored.set("access_token", jwt("b"));
  window.dispatchEvent(Object.assign(new Event(event), event === "storage" ? { key: "access_token" } : {}));
  cleanup?.(); cleanup = undefined;
  await vi.advanceTimersByTimeAsync(15_000);
  expect(harness.report).not.toHaveBeenCalled();
  expect([...stored.keys()].some(key => key.startsWith("learnup.video-progress:"))).toBe(true);
});
it("ended reports duration and restoration near the end starts at zero", async () => {
  const { hook, media } = VideoHarness(); hook.events.onPlaying(); media.currentTime = 600.9; hook.events.onEnded();
  await vi.advanceTimersByTimeAsync(0);
  expect(harness.report.mock.calls[0][2].positionSeconds).toBe(601);
  media.currentTime = 600; hook.events.onLoadedMetadata(); expect(media.currentTime).toBe(0);
});
