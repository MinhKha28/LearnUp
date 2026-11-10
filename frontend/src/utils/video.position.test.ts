import { afterEach, expect, it, vi } from "vitest";
import {
  chooseVideoPosition,
  clearVideoPositionSession,
  VIDEO_POSITION_SESSION_PREFIX,
  videoResumePosition,
} from "./video.position";
import { clearTokens } from "./auth";

afterEach(() => vi.unstubAllGlobals());

it.each([
  [null, 0],
  [0, 0],
  [10, 10],
  [595, 595],
  [596, 0],
  [600, 0],
  [601, 0],
  [700, 0],
])(
  "BR-182 restores position %s in a 601-second video to %s",
  (position, expected) =>
    expect(videoResumePosition(position, 601)).toBe(expected),
);
it("BR-182 restarts videos shorter than five seconds", () => {
  expect(videoResumePosition(2, 4)).toBe(0);
});
const now = Date.parse("2026-10-22T06:00:00Z");
const server = {
  positionSeconds: 10,
  reportedAt: new Date(now - 60_000).toISOString(),
};
it.each([
  [null, 10],
  [
    { positionSeconds: 60, reportedAt: new Date(now - 1_000).toISOString() },
    60,
  ],
  [{ positionSeconds: 5, reportedAt: new Date(now - 1_000).toISOString() }, 5],
  [
    { positionSeconds: 20, reportedAt: new Date(now - 90_000).toISOString() },
    10,
  ],
  [{ positionSeconds: 20, reportedAt: server.reportedAt }, 10],
  [
    { positionSeconds: 20, reportedAt: new Date(now - 120_000).toISOString() },
    10,
  ],
  [
    { positionSeconds: 20, reportedAt: new Date(now - 121_000).toISOString() },
    10,
  ],
  [{ positionSeconds: 20, reportedAt: "invalid" }, 10],
  [
    { positionSeconds: 20, reportedAt: new Date(now + 121_000).toISOString() },
    10,
  ],
  [{ positionSeconds: -1, reportedAt: new Date(now).toISOString() }, 10],
])("selects server or a recent newer session %j", (session, expected) => {
  expect(chooseVideoPosition(server, session, now).positionSeconds).toBe(
    expected,
  );
});
it("uses a recent session when the server has no position", () => {
  expect(
    chooseVideoPosition(
      { positionSeconds: null, reportedAt: null },
      { positionSeconds: 9, reportedAt: new Date(now).toISOString() },
      now,
    ).positionSeconds,
  ).toBe(9);
});
it("logout clears only video position keys and prevents cleanup from recreating them", () => {
  const removeItem = vi.fn();
  vi.stubGlobal("sessionStorage", {
    [VIDEO_POSITION_SESSION_PREFIX + "u:m"]: "position",
    unrelated: "keep",
    removeItem,
  });
  const removeToken = vi.fn(),
    dispatchEvent = vi.fn();
  vi.stubGlobal("localStorage", { removeItem: removeToken });
  vi.stubGlobal("window", { dispatchEvent });
  clearTokens();
  expect(removeItem).toHaveBeenCalledTimes(1);
  expect(removeItem).toHaveBeenCalledWith(
    VIDEO_POSITION_SESSION_PREFIX + "u:m",
  );
  expect(dispatchEvent.mock.calls[0][0].type).toBe("auth-cleared");
  expect(removeToken).toHaveBeenCalledTimes(2);
});
it("blocked sessionStorage does not prevent session cleanup", () => {
  vi.stubGlobal("sessionStorage", null);
  expect(() => clearVideoPositionSession()).not.toThrow();
});
