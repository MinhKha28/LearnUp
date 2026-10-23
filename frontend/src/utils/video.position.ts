export interface VideoPosition {
  positionSeconds: number | null;
  reportedAt: string | null;
}

export const VIDEO_POSITION_SESSION_PREFIX = "learnup.video-position:";

/** BR-182: session chỉ che lần đọc cũ trong vòng hai phút. */
export const chooseVideoPosition = (
  server: VideoPosition,
  session: VideoPosition | null,
  now = Date.now(),
): VideoPosition => {
  const localTime = Date.parse(session?.reportedAt ?? "");
  const serverTime = Date.parse(server.reportedAt ?? "");
  return session &&
    Number.isSafeInteger(session.positionSeconds) &&
    session.positionSeconds! >= 0 &&
    Math.abs(now - localTime) < 120_000 &&
    (!Number.isFinite(serverTime) || localTime > serverTime)
    ? session
    : server;
};

/** BR-182: phát lại từ đầu khi chưa có vị trí hoặc còn tối đa năm giây. */
export const videoResumePosition = (
  position: number | null,
  duration: number,
) =>
  position === null ||
  !Number.isFinite(position) ||
  position < 0 ||
  position >= duration - 5
    ? 0
    : position;

export const clearVideoPositionSession = () => {
  try {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith(VIDEO_POSITION_SESSION_PREFIX))
        sessionStorage.removeItem(key);
  } catch {
    // Storage có thể bị chặn; đăng xuất vẫn phải hoàn tất.
  }
};
