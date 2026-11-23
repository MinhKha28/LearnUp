import { courseStatusLabel } from "@/utils/course.status.labels";
import { ENROLLMENT_TYPE_LABELS, MATERIAL_TYPE_LABELS } from "@/utils/learner.labels";

// Nhãn tiếng Việt cho các giá trị trạng thái/loại do API trả về (chỉ để hiển thị, không đổi giá trị gửi lên API).
// Giá trị rỗng hiện "—"; giá trị lạ hiện "Không xác định", không bao giờ lộ giá trị tiếng Anh thô.
export const UNKNOWN_LABEL = "Không xác định";

const labelOf = (map: Record<string, string>, value: string | null | undefined) => {
  if (!value) return "—";
  return Object.prototype.hasOwnProperty.call(map, value) ? map[value] : UNKNOWN_LABEL;
};

const COURSE_TYPE: Record<string, string> = { Public: "Công khai", Private: "Riêng tư" };
const ACCOUNT_STATUS: Record<string, string> = {
  Active: "Đang hoạt động",
  Pending: "Chờ kích hoạt",
  Deactivated: "Đã vô hiệu hóa",
};
const QUESTION_TYPE: Record<string, string> = {
  SingleChoice: "Một đáp án đúng",
  MultipleChoice: "Nhiều đáp án đúng",
  TrueFalse: "Đúng/Sai",
};

export const courseStatusText = (v?: string | null) => labelOf(courseStatusLabel, v);
export const courseTypeText = (v?: string | null) => labelOf(COURSE_TYPE, v);
export const enrollmentKindText = (v?: string | null) => labelOf(ENROLLMENT_TYPE_LABELS, v);
export const accountStatusText = (v?: string | null) => labelOf(ACCOUNT_STATUS, v);
export const questionTypeText = (v?: string | null) => labelOf(QUESTION_TYPE, v);
export const materialTypeText = (v?: string | null) => labelOf(MATERIAL_TYPE_LABELS, v);
