import { describe, expect, it } from "vitest";
import type { IQuizPermission, IQuizPermissions } from "@/types/assessment.types";
import {
  combinePermissions,
  formatQuizScore,
  hasCorrectOption,
  optionLetter,
  permissionReasonTexts,
  QUIZ_LOCK_REASON_TEXT,
  quizBannerReasons,
  quizAttemptLimitLabel,
  quizPlacementLabel,
  quizQuestionTypeLabel,
} from "@/utils/quiz.view";

const open: IQuizPermission = { allowed: true, reasons: [] };
const permissions = (over: Partial<IQuizPermissions> = {}): IQuizPermissions => ({
  editQuestions: open,
  editTimeLimit: open,
  editAttemptRule: open,
  editPassingScore: open,
  editRequired: open,
  deleteQuiz: open,
  deleteLastQuestion: open,
  ...over,
});

describe("UC18.1 view", () => {
  it("labels the three question types and handles an unknown value (BR-155)", () => {
    expect(quizQuestionTypeLabel("SingleChoice")).toBe("Một đáp án đúng");
    expect(quizQuestionTypeLabel("MultipleChoice")).toBe("Nhiều đáp án đúng");
    expect(quizQuestionTypeLabel("TrueFalse")).toBe("Đúng / Sai");
    expect(quizQuestionTypeLabel("SINGLE")).toBe("Không xác định");
  });

  it("shows scores on the 0–100 scale with at most 2 decimals (BR-315)", () => {
    expect(formatQuizScore(80)).toBe("80");
    expect(formatQuizScore(72.5)).toBe("72.5");
    expect(formatQuizScore(66.666)).toBe("66.67");
    expect(formatQuizScore(100)).toBe("100");
  });

  it("letters the options", () => {
    expect([0, 1, 2].map(optionLetter)).toEqual(["A", "B", "C"]);
  });

  const modules = [{ id: "m1", title: "Giới thiệu" }, { id: "m2", title: "An toàn" }];

  it("places a course-level quiz at the end of the course", () => {
    expect(quizPlacementLabel({ moduleId: null }, modules)).toBe("Cuối khóa học");
    expect(quizPlacementLabel({ placement: "COURSE" }, modules)).toBe("Cuối khóa học");
  });

  it("places a chapter-level quiz after that chapter's lessons", () => {
    expect(quizPlacementLabel({ moduleId: "m2", placement: "MODULE" }, modules))
      .toBe("Sau các bài học của chương 2: An toàn");
  });

  it("reports a chapter missing from the outline", () => {
    expect(quizPlacementLabel({ moduleId: "gone" }, modules))
      .toBe("Không tìm thấy chương trong cấu trúc khóa học");
  });

  it("reports missing placement data", () => {
    expect(quizPlacementLabel({}, modules)).toBe("Chưa xác định vị trí");
  });

  it("labels the attempt limit and handles either missing setting", () => {
    expect(quizAttemptLimitLabel(3, 24)).toBe("Tạm khóa trong 24 giờ sau 3 lượt làm liên tiếp.");
    expect(quizAttemptLimitLabel(null, 24)).toBe("Chưa xác định");
    expect(quizAttemptLimitLabel(3, null)).toBe("Chưa xác định");
    expect(quizAttemptLimitLabel(3)).toBe("Chưa xác định");
  });

  it("explains a blocked permission and says nothing about an allowed one (BR-99)", () => {
    expect(permissionReasonTexts(open)).toEqual([]);
    expect(permissionReasonTexts({ allowed: false, reasons: ["COURSE_LOCKED", "QUIZ_HAS_ATTEMPTS"] })).toEqual([
      QUIZ_LOCK_REASON_TEXT.COURSE_LOCKED,
      QUIZ_LOCK_REASON_TEXT.QUIZ_HAS_ATTEMPTS,
    ]);
  });

  it("has a sentence for every lock reason", () => {
    for (const text of Object.values(QUIZ_LOCK_REASON_TEXT)) expect(text.length).toBeGreaterThan(0);
    expect(Object.keys(QUIZ_LOCK_REASON_TEXT).sort()).toEqual(
      ["COURSE_LEFT_DRAFT", "COURSE_LOCKED", "COURSE_NOT_EDITABLE", "COURSE_SUBMITTED", "QUIZ_HAS_ATTEMPTS"].sort(),
    );
  });

  it("opens a combined action when any part is open, otherwise lists every reason once", () => {
    const attempts: IQuizPermission = { allowed: false, reasons: ["QUIZ_HAS_ATTEMPTS"] };
    const locked: IQuizPermission = { allowed: false, reasons: ["COURSE_LOCKED"] };
    const submitted: IQuizPermission = { allowed: false, reasons: ["COURSE_SUBMITTED"] };
    expect(combinePermissions([attempts, open])).toEqual(open);
    expect(combinePermissions([attempts, locked, attempts])).toEqual({
      allowed: false,
      reasons: ["QUIZ_HAS_ATTEMPTS", "COURSE_LOCKED"],
    });
    expect(combinePermissions([submitted, submitted])).toEqual(submitted);
  });

  it("puts Course-wide banners first and leaves out the last-question reason", () => {
    expect(quizBannerReasons(permissions())).toEqual([]);
    expect(
      quizBannerReasons(
        permissions({
          editQuestions: { allowed: false, reasons: ["QUIZ_HAS_ATTEMPTS"] },
          editPassingScore: { allowed: false, reasons: ["COURSE_LOCKED"] },
          deleteLastQuestion: { allowed: false, reasons: ["QUIZ_HAS_ATTEMPTS", "COURSE_LEFT_DRAFT"] },
        }),
      ),
    ).toEqual(["COURSE_LOCKED", "QUIZ_HAS_ATTEMPTS"]);
    const submitted: IQuizPermission = { allowed: false, reasons: ["COURSE_SUBMITTED"] };
    expect(quizBannerReasons(permissions({ editQuestions: submitted, deleteQuiz: submitted }))).toEqual([
      "COURSE_SUBMITTED",
    ]);
  });

  it("spots a question without a correct option", () => {
    const option = { id: "o", position: 1, content: "A", isCorrect: false };
    const question = { id: "q", position: 1, type: "SingleChoice", content: "Q?", options: [option] };
    expect(hasCorrectOption(question)).toBe(false);
    expect(hasCorrectOption({ ...question, options: [{ ...option, isCorrect: true }] })).toBe(true);
  });
});
