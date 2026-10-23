export type MediaRange = [number, number];
export interface VideoSegments {
  start: number | null;
  lastTime: number;
  closed: MediaRange[];
}
export const createSegments = (): VideoSegments => ({
  start: null,
  lastTime: 0,
  closed: [],
});
export const mergeSegments = (ranges: MediaRange[]): MediaRange[] => {
  const merged: MediaRange[] = [];
  for (const [start, end] of ranges
    .filter(
      ([s, e]) => Number.isFinite(s) && Number.isFinite(e) && s >= 0 && s < e,
    )
    .sort((a, b) => a[0] - b[0])) {
    const previous = merged[merged.length - 1];
    if (previous && start <= previous[1])
      previous[1] = Math.max(previous[1], end);
    else merged.push([start, end]);
  }
  return merged;
};
export const openSegment = (
  state: VideoSegments,
  time: number,
): VideoSegments =>
  state.start === null ? { ...state, start: time, lastTime: time } : state;
export const updateSegment = (
  state: VideoSegments,
  time: number,
): VideoSegments => ({ ...state, lastTime: time });
/** seeking closes at the last media time observed before the seek destination. */
export const closeSegment = (state: VideoSegments): VideoSegments => ({
  ...state,
  start: null,
  closed: mergeSegments([
    ...state.closed,
    ...(state.start !== null && state.lastTime > state.start
      ? [[state.start, state.lastTime] as MediaRange]
      : []),
  ]),
});
export const pendingSegments = (state: VideoSegments): MediaRange[] =>
  mergeSegments([
    ...state.closed,
    ...(state.start !== null && state.lastTime > state.start
      ? [[state.start, state.lastTime] as MediaRange]
      : []),
  ]).slice(0, 20);
/** Remove only acknowledged coverage; intervals closed while a request was in flight survive. */
export const acknowledgeSegments = (
  state: VideoSegments,
  sent: MediaRange[],
): VideoSegments => {
  let remaining = state.closed;
  for (const [s, e] of sent)
    remaining = remaining.flatMap(([a, b]): MediaRange[] =>
      e <= a || s >= b
        ? [[a, b]]
        : [
            ...(a < s ? [[a, s] as MediaRange] : []),
            ...(e < b ? [[e, b] as MediaRange] : []),
          ],
    );
  return { ...state, closed: remaining };
};
