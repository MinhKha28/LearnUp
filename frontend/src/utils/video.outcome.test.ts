import { it, expect } from "vitest";
import { ApiError } from "@/types/api.types";
import { applyVideoProgress, videoOutcome } from "./video.outcome";
import type { VideoProgress } from "@/types/learning.types";
it("keeps monotonic progress and completion when keepalive responses arrive out of order", () => {
  const current = {
    watchedSeconds: 541,
    completed: true,
    completedAt: "2026-10-18T00:00:00Z",
  } as VideoProgress;
  expect(
    applyVideoProgress(current, {
      ...current,
      watchedSeconds: 511,
      completed: false,
    }),
  ).toBe(current);
  expect(
    applyVideoProgress(current, { ...current, watchedSeconds: 542 }),
  ).toHaveProperty("watchedSeconds", 542);
});
it.each([
  [404, "MATERIAL_NOT_FOUND", "Không tìm"],
  [403, "CONTENT_UNAVAILABLE", "tạm ngưng"],
  [503, "PLAYBACK_UNAVAILABLE", "chưa sẵn sàng"],
  [0, "NETWORK", "thử lại"],
])("maps video error %s", (status, code, text) => {
  expect(
    videoOutcome(new ApiError(Number(status), String(code), "")),
  ).toContain(String(text));
});
