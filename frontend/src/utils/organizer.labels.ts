// Nhãn tiếng Việt cho các giá trị trạng thái/loại do API trả về (chỉ để hiển thị, không đổi giá trị gửi lên API).
const labelOf = (map: Record<string, string>, value: string | null | undefined) =>
  (value ? map[value] : undefined) ?? value ?? "—";

const COURSE_STATUS: Record<string, string> = {
  Draft: "Bản nháp",
  Submitted: "Chờ phê duyệt",
  Published: "Đã phát hành",
  Rejected: "Bị từ chối",
  Archived: "Đã lưu trữ",
  Disabled: "Đã vô hiệu hóa",
};
const COURSE_TYPE: Record<string, string> = { Public: "Công khai", Private: "Riêng tư" };
const ENROLLMENT_KIND: Record<string, string> = { Required: "Bắt buộc", Optional: "Tự chọn" };
const ACCOUNT_STATUS: Record<string, string> = {
  Active: "Đang hoạt động",
  Pending: "Chờ kích hoạt",
  Deactivated: "Đã vô hiệu hóa",
};

export const courseStatusText = (v?: string | null) => labelOf(COURSE_STATUS, v);
export const courseTypeText = (v?: string | null) => labelOf(COURSE_TYPE, v);
export const enrollmentKindText = (v?: string | null) => labelOf(ENROLLMENT_KIND, v);
export const accountStatusText = (v?: string | null) => labelOf(ACCOUNT_STATUS, v);

const QUESTION_TYPE: Record<string, string> = {
  SingleChoice: "Một đáp án đúng",
  MultipleChoice: "Nhiều đáp án đúng",
  TrueFalse: "Đúng/Sai",
};
const MATERIAL_TYPE: Record<string, string> = { Video: "Video", Reading: "Tài liệu đọc" };

export const questionTypeText = (v?: string | null) => labelOf(QUESTION_TYPE, v);
export const materialTypeText = (v?: string | null) => labelOf(MATERIAL_TYPE, v);
