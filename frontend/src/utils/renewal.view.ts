import type { IRenewalQuote } from "@/types/subscription.types";
import { formatStorage } from "@/utils/helper";

const LIMIT_LABELS: Record<string, string> = {
  learners: "Số học viên",
  instructors: "Số giảng viên",
  courses: "Số khóa học",
  storageBytes: "Dung lượng lưu trữ",
};

export const exceededLimitLines = (
  exceeded: IRenewalQuote["exceededLimits"],
): string[] =>
  exceeded.map(({ limit, used, newLimit }) => {
    const label = LIMIT_LABELS[limit] ?? limit;
    return limit === "storageBytes"
      ? `${label}: đang dùng ${formatStorage(used)}, giới hạn mới ${formatStorage(newLimit)}`
      : `${label}: đang dùng ${used}, giới hạn mới ${newLimit}`;
  });

export const renewalTermNote = (status: IRenewalQuote["currentStatus"]) => {
  switch (status) {
    case "Grace":
      return "Gói dịch vụ đang trong thời gian ân hạn: kỳ mới tính từ ngày hết hạn cũ, nên những ngày ân hạn đã dùng được trừ vào kỳ mới.";
    case "Suspended":
      return "Gói dịch vụ đang tạm ngưng: kỳ mới bắt đầu từ ngày thanh toán và toàn bộ quyền truy cập được khôi phục ngay.";
    default:
      return "Kỳ hiện tại vẫn tiếp tục: kỳ mới bắt đầu khi kỳ hiện tại hết hạn.";
  }
};

export const RENEWAL_NOT_APPLIED = "RENEWAL_NOT_APPLIED";

export const renewalErrorMessage = (code: string | undefined) => {
  switch (code) {
    case RENEWAL_NOT_APPLIED:
      return "Thanh toán của bạn đã được ghi nhận nhưng chưa gia hạn được. Đừng thanh toán lần nữa, hãy liên hệ bộ phận hỗ trợ.";
    case "RENEWAL_ALREADY_SCHEDULED":
      return "Đã có một kỳ gia hạn được thanh toán và đang chờ bắt đầu. Bạn có thể gia hạn tiếp sau khi kỳ đó bắt đầu.";
    case "RENEWAL_IN_PROGRESS":
      return "Một yêu cầu gia hạn khác đang được xử lý. Vui lòng đợi một chút rồi thử lại.";
    case "ORGANIZATION_NOT_ACTIVE":
      return "Tổ chức của bạn không ở trạng thái hoạt động nên không gia hạn được gói dịch vụ.";
    case "SUBSCRIPTION_NOT_FOUND":
      return "Tổ chức của bạn chưa có gói dịch vụ để gia hạn.";
    default:
      return "Chưa xử lý được yêu cầu gia hạn. Vui lòng thử lại sau.";
  }
};
