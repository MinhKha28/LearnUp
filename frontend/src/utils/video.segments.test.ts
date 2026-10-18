import { describe, it, expect } from "vitest";
import {
  acknowledgeSegments,
  closeSegment,
  createSegments,
  mergeSegments,
  openSegment,
  pendingSegments,
  rejectSegments,
  updateSegment,
} from "./video.segments";
describe("UC27.2 media segments", () => {
  it("playing/timeupdate sends the open segment again until closed", () => {
    let s = openSegment(createSegments(), 0);
    s = updateSegment(s, 15);
    expect(pendingSegments(s)).toEqual([[0, 15]]);
    s = acknowledgeSegments(s, [[0, 15]]);
    s = updateSegment(s, 30);
    expect(pendingSegments(s)).toEqual([[0, 30]]);
  });
  it("seeking closes at lastTime and never bridges to the destination", () => {
    let s = closeSegment(updateSegment(openSegment(createSegments(), 0), 12));
    s = updateSegment(openSegment(s, 500), 510);
    expect(pendingSegments(s)).toEqual([
      [0, 12],
      [500, 510],
    ]);
    expect(pendingSegments(closeSegment(s))).toEqual([
      [0, 12],
      [500, 510],
    ]);
  });
  it("backward replay merges coverage and duplicate events cannot reset the start", () => {
    const s = updateSegment(
      openSegment(openSegment(createSegments(), 0), 5),
      10,
    );
    expect(pendingSegments(s)).toEqual([[0, 10]]);
    expect(
      mergeSegments([
        [0, 10],
        [5, 12],
        [12, 15],
      ]),
    ).toEqual([[0, 15]]);
  });
  it("retains failed batches, caps each report at 20 and acknowledges only sent coverage", () => {
    const closed = Array.from({ length: 25 }, (_, i): [number, number] => [
      i * 3,
      i * 3 + 1,
    ]);
    const s = { start: null, lastTime: 0, closed };
    const sent = pendingSegments(s);
    expect(sent).toHaveLength(20);
    expect(pendingSegments(s)).toEqual(sent);
    expect(acknowledgeSegments(s, sent).closed).toEqual(closed.slice(20));
  });
  it("preserves intervals created during an in-flight report", () => {
    expect(
      acknowledgeSegments({ start: null, lastTime: 20, closed: [[0, 20]] }, [
        [0, 15],
      ]).closed,
    ).toEqual([[15, 20]]);
  });
  it("a rate rejection restarts at currentTime and discards rejected coverage", () => {
    expect(rejectSegments(500, true)).toEqual({
      start: 500,
      lastTime: 500,
      closed: [],
    });
    expect(rejectSegments(500, false).start).toBeNull();
  });
});
