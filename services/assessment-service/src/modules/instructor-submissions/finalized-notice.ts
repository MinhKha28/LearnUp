/**
 * The notice of UC32.3 (BR-254): the Instructor published the final score of a submission, so the Learner is told.
 * The Learner reads it, so it is Vietnamese. The score is the one of the Assignment, on a scale of 100.
 */
export interface FinalizedNotice {
  title: string;
  message: string;
}

/** 66.67 -> "66,67", 80 -> "80": the Vietnamese decimal comma, at most two decimals. */
const formatScore = (score: number): string =>
  score.toLocaleString('vi-VN', { maximumFractionDigits: 2 });

export const finalizedNotice = (
  assignmentTitle: string,
  finalScore: number,
): FinalizedNotice => ({
  title: 'Điểm bài tập đã được công bố',
  message: `Giảng viên đã chốt điểm cho "${assignmentTitle}". Điểm cuối cùng của bạn là ${formatScore(finalScore)}%. Bạn có thể xem chi tiết trong kết quả của khóa học.`,
});
