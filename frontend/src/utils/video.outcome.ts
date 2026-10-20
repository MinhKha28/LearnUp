import type { ApiError } from "@/types/api.types";
import type { VideoProgress } from "@/types/learning.types";
export const applyVideoProgress = (
  current: VideoProgress,
  incoming: VideoProgress,
): VideoProgress =>
  current.watchedSeconds > incoming.watchedSeconds ||
  (current.completed && !incoming.completed)
    ? current
    : incoming;
export const videoOutcome = (error: ApiError): string => {
  if (error.status === 404)
    return "Không tìm thấy học liệu hoặc Khóa học của bạn.";
  if (error.status === 403)
    return "Nội dung đang tạm ngưng hoặc bạn không có quyền truy cập.";
  if (error.code === "PLAYBACK_UNAVAILABLE")
    return "Video chưa sẵn sàng. Vui lòng thử lại sau.";
  if (error.status === 0)
    return "Chưa lưu được tiến độ. Hệ thống sẽ thử lại ở nhịp tiếp theo.";
  return "Chưa thể tải hoặc lưu tiến độ Video. Vui lòng thử lại.";
};
