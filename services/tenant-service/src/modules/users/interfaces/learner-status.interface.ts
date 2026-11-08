/** UC13.5: kết quả PATCH learners/:id/status. changed = false: đã ở trạng thái đích (bấm lặp). */
export interface ILearnerStatusResult {
  id: string;
  status: string;
  changed: boolean;
}
