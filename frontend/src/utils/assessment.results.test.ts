import { describe, expect, it } from "vitest";
import type { AssessmentResultItem } from "@/types/learning.types";
import {
  attemptsLine,
  formatResultScore,
  formatResultTime,
  gapText,
  kindLabel,
  requirementLabel,
  resultStatusView,
  resultTarget,
  scoreBar,
  summaryLine,
} from "./assessment.results";

const quiz = (
  over: Partial<AssessmentResultItem> = {},
): AssessmentResultItem => ({
  assessmentId: "q-1",
  kind: "QUIZ",
  title: "Quiz an toàn",
  isRequired: true,
  disabled: false,
  passingScore: 70,
  status: "Completed",
  recordedScore: 85,
  passed: true,
  attemptCount: 2,
  lastActivityAt: "2026-11-05T10:00:00.000Z",
  quiz: {
    bestAttemptNumber: 2,
    attempts: [
      {
        attemptNumber: 1,
        score: 50,
        submittedAt: "2026-11-05T09:00:00.000Z",
        submissionKind: "Manual",
      },
      {
        attemptNumber: 2,
        score: 85.5,
        submittedAt: "2026-11-05T10:00:00.000Z",
        submissionKind: "TimedOut",
      },
    ],
  },
  assignment: null,
  ...over,
});
const assignment = (
  over: Partial<AssessmentResultItem> = {},
): AssessmentResultItem => ({
  ...quiz(),
  assessmentId: "a-1",
  kind: "ASSIGNMENT",
  title: "Bài luận",
  passingScore: 60,
  status: "AwaitingResult",
  recordedScore: null,
  passed: null,
  quiz: null,
  assignment: {
    latestSubmissionNumber: 1,
    gradingStatus: "AwaitingInstructor",
  },
  ...over,
});

describe("the words of the results", () => {
  it("a score is written the Vietnamese way, with at most two decimals", () => {
    expect(formatResultScore(50)).toBe("50");
    expect(formatResultScore(66.67)).toBe("66,67");
    expect(formatResultScore(85.5)).toBe("85,5");
    expect(formatResultScore(0)).toBe("0");
  });

  it("the kind and the requirement", () => {
    expect(kindLabel(quiz())).toBe("Bài trắc nghiệm");
    expect(kindLabel(assignment())).toBe("Bài tập");
    expect(requirementLabel(quiz())).toBe("Bắt buộc");
    expect(requirementLabel(quiz({ isRequired: false }))).toBe(
      "Không bắt buộc",
    );
  });

  it("the status follows the score against the passing score; no score is never 'failed' (BR-191)", () => {
    expect(resultStatusView(quiz())).toEqual({ label: "Đạt", tone: "success" });
    expect(
      resultStatusView(quiz({ recordedScore: 20, passed: false })),
    ).toEqual({ label: "Chưa đạt", tone: "error" });
    expect(
      resultStatusView(quiz({ recordedScore: 0, passed: false })).label,
    ).toBe("Chưa đạt");
    expect(resultStatusView(assignment())).toEqual({
      label: "Chờ chấm",
      tone: "warning",
    });
    expect(
      resultStatusView(
        quiz({ status: "InProgress", recordedScore: null, passed: null }),
      ),
    ).toEqual({ label: "Đang làm", tone: "info" });
  });

  it("the comparison with the passing score is said in points", () => {
    expect(gapText(quiz())).toBe("Cao hơn điểm đạt 15 điểm");
    expect(gapText(quiz({ recordedScore: 70, passed: true }))).toBe(
      "Vừa đủ điểm đạt",
    );
    expect(gapText(quiz({ recordedScore: 69.5, passed: false }))).toBe(
      "Còn thiếu 0,5 điểm để đạt",
    );
    expect(gapText(quiz({ recordedScore: 20, passed: false }))).toBe(
      "Còn thiếu 50 điểm để đạt",
    );
    expect(gapText(assignment())).toBe("Đang chờ chấm điểm");
    expect(
      gapText(
        quiz({ status: "InProgress", recordedScore: null, passed: null }),
      ),
    ).toBe("Chưa có điểm để so sánh");
  });

  it("the bar stays between 0 and 100 whatever the numbers are", () => {
    expect(scoreBar(quiz())).toEqual({ score: 85, passing: 70 });
    expect(scoreBar(assignment())).toEqual({ score: 0, passing: 60 });
    expect(scoreBar(quiz({ recordedScore: 140, passingScore: 150 }))).toEqual({
      score: 100,
      passing: 100,
    });
    expect(scoreBar(quiz({ recordedScore: -3, passingScore: -1 }))).toEqual({
      score: 0,
      passing: 0,
    });
  });

  it("the attempts of a Quiz are one line, a time-out is marked; an Assignment has none", () => {
    expect(attemptsLine(quiz())).toBe("Lượt 1: 50% · Lượt 2: 85,5% (hết giờ)");
    expect(attemptsLine(assignment())).toBe("");
    expect(
      attemptsLine(quiz({ quiz: { bestAttemptNumber: null, attempts: [] } })),
    ).toBe("");
  });

  it("the summary is a sentence that leaves out what is zero", () => {
    expect(summaryLine({ total: 0, passed: 0, notPassed: 0, pending: 0 })).toBe(
      "Bạn chưa làm bài trắc nghiệm hoặc bài tập nào trong khóa học này.",
    );
    expect(summaryLine({ total: 3, passed: 3, notPassed: 0, pending: 0 })).toBe(
      "Đã làm 3 bài, đạt 3.",
    );
    expect(summaryLine({ total: 4, passed: 1, notPassed: 2, pending: 1 })).toBe(
      "Đã làm 4 bài, đạt 1, chưa đạt 2, chờ kết quả 1.",
    );
  });

  it("times are in the Vietnamese order", () => {
    expect(formatResultTime("2026-11-05T23:45:00.000Z")).toBe("06/11/2026 06:45");
  });
});

describe("where a row leads", () => {
  it("a Quiz to its history, or back into the attempt that is running", () => {
    expect(resultTarget("e-1", quiz())).toEqual({
      label: "Lịch sử làm bài",
      to: "/learner/courses/e-1/quizzes/q-1/history",
    });
    expect(resultTarget("e-1", quiz({ status: "InProgress" }))).toEqual({
      label: "Tiếp tục làm bài",
      to: "/learner/courses/e-1/quizzes/q-1",
    });
  });

  it("an Assignment to its grading result once graded, else to the list", () => {
    expect(
      resultTarget(
        "e-1",
        assignment({ status: "Completed", recordedScore: 80, passed: true }),
      ),
    ).toEqual({
      label: "Xem kết quả chấm",
      to: "/learner/courses/e-1/assignments/a-1/result",
    });
    expect(resultTarget("e-1", assignment())).toEqual({
      label: "Xem bài tập",
      to: "/learner/courses/e-1/assessments",
    });
  });
});
