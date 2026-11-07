/** A Learner the tenant does not know still has a row: the end of the id tells them apart. */
export const learnerLabel = (fullName: string, learnerId: string) =>
  fullName || `Học viên …${learnerId.slice(-4)}`;

/** The server's messages are English: the screens of UC33.1 and UC33.2 say these codes in Vietnamese. */
const CYCLE_ERROR_TEXT: Record<string, string> = {
  CYCLE_NOT_FOUND: "Chu kỳ chấm chéo này có thể đã bị xóa.",
  PEER_REVIEW_NOT_ENABLED: "Bài tập này chưa bật chấm chéo nên chưa có chu kỳ nào.",
  ASSIGNMENT_NOT_FOUND: "Không tìm thấy bài tập.",
  NOT_OWING_PEER_REVIEW: "Học viên này không còn nghĩa vụ chấm chéo nên không có gì để miễn.",
};

export const cycleErrorText = (res: unknown, fallback: string): string => {
  const { error } = res as { error?: { code?: string } | string };
  return (typeof error === "object" && CYCLE_ERROR_TEXT[error?.code ?? ""]) || fallback;
};
