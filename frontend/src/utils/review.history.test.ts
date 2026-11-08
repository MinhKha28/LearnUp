import { describe, expect, it } from "vitest";
import type {
  IReviewHistoryItem,
  TObligationStatus,
} from "@/types/assessment.types";
import {
  criteriaLine,
  dutyLine,
  formatReviewTime,
  obligationView,
  progressText,
  reviewLabel,
  scoreText,
} from "./review.history";

const item = (over: Partial<IReviewHistoryItem> = {}): IReviewHistoryItem => ({
  id: "00000000-0000-4000-8000-0000000000ab",
  assignmentId: "a-1",
  assignmentTitle: "Bài luận",
  courseId: "c-1",
  score: 90,
  completedAt: "2026-11-05T10:00:00.000Z",
  comment: null,
  criteria: [
    { criterionId: "r1", name: "Nội dung", points: 55, maxPoints: 60 },
    { criterionId: "r2", name: "Trình bày", points: 35, maxPoints: 40 },
  ],
  ...over,
});

describe("the duty of peer review in words", () => {
  const all: TObligationStatus[] = [
    "Satisfied",
    "Waived",
    "Pending",
    "Missed",
    "NotApplicable",
  ];

  it("every state has a label, a tone and a help text in Vietnamese", () => {
    for (const status of all) {
      const view = obligationView(status);
      expect(view.label).toMatch(/[A-Za-zÀ-ỹ]/);
      expect(view.help.length).toBeGreaterThan(10);
      expect(view.help).not.toMatch(/Satisfied|Pending|Missed|Waived|duty/);
    }
  });

  it("done is green, owed is amber, missed is red, waived is informative", () => {
    expect(obligationView("Satisfied")).toMatchObject({
      label: "Hoàn thành",
      tone: "success",
    });
    expect(obligationView("Pending")).toMatchObject({
      label: "Đang thực hiện",
      tone: "warning",
    });
    expect(obligationView("Missed")).toMatchObject({
      label: "Chưa hoàn thành",
      tone: "error",
    });
    expect(obligationView("Waived")).toMatchObject({
      label: "Được miễn",
      tone: "info",
    });
    expect(obligationView("NotApplicable").tone).toBe("neutral");
  });

  it("a missed duty tells how it is paid back (BR-239)", () => {
    // paying it back needs a new submission (so that the Learner is assigned in a later cycle) or a waiver, not just waiting
    const help = obligationView("Missed").help;
    expect(help).toMatch(/nộp lại bài/);
    expect(help).toMatch(/chu kỳ sau/);
    expect(help).toMatch(/giảng viên miễn/);
    expect(help).not.toMatch(/^Chấm đủ/);
  });

  it("the line above the table says how many were handed out and given, or that none was", () => {
    expect(dutyLine(3, 1)).toBe("Số bài được giao: 3. Đã chấm: 1.");
    expect(dutyLine(0, 0)).toBe("Bạn chưa được giao bài chấm chéo nào.");
  });

  it("the count of an Assignment", () => {
    expect(
      progressText({
        assignmentId: "a",
        assignmentTitle: "t",
        courseId: "c",
        status: "Pending",
        requiredCount: 2,
        completedCount: 1,
      }),
    ).toBe("1/2 bài");
  });
});

describe("a review in the history", () => {
  it("a score is written the Vietnamese way; none is a dash, 0 is 0", () => {
    expect(scoreText(66.67)).toBe("66,67");
    expect(scoreText(90)).toBe("90");
    expect(scoreText(0)).toBe("0");
    expect(scoreText(null)).toBe("-");
  });

  it("the review is named by the end of its id, never by the author", () => {
    expect(reviewLabel(item())).toBe("Bài nộp 00AB");
  });

  it("the time is in the Vietnamese order; none is a dash", () => {
    expect(formatReviewTime("2026-11-05T10:00:00.000Z")).toMatch(
      /05\/11\/2026/,
    );
    expect(formatReviewTime(null)).toBe("-");
  });

  it("the points of every criterion in one line", () => {
    expect(criteriaLine(item())).toBe("Nội dung 55/60 · Trình bày 35/40");
    expect(criteriaLine(item({ criteria: [] }))).toBe("");
  });
});
