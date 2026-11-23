import { formatPercentageVN } from "./number.format";
import { describe, expect, it } from "vitest";
import {
  clockOffsetMs,
  formatCountdown,
  questionTypeLabel,
  QUIZ_STALE_CODES,
  quizErrorText,
  secondsLeft,
  selectionAfterClick,
} from "./quiz.take";

describe("selectionAfterClick", () => {
  it("a single-choice or true/false question keeps one option: the new click replaces the choice", () => {
    expect(selectionAfterClick("SingleChoice", [], "a")).toEqual(["a"]);
    expect(selectionAfterClick("SingleChoice", ["a"], "b")).toEqual(["b"]);
    expect(selectionAfterClick("TrueFalse", ["t"], "f")).toEqual(["f"]);
  });

  it("clicking the option already chosen in a single-choice question keeps it (it is not cleared)", () => {
    const current = ["a"];
    expect(selectionAfterClick("SingleChoice", current, "a")).toBe(current);
  });

  it("a multiple-choice question adds an option and takes it off with a second click", () => {
    expect(selectionAfterClick("MultipleChoice", [], "x")).toEqual(["x"]);
    expect(selectionAfterClick("MultipleChoice", ["x"], "y")).toEqual([
      "x",
      "y",
    ]);
    expect(selectionAfterClick("MultipleChoice", ["x", "y"], "x")).toEqual([
      "y",
    ]);
    expect(selectionAfterClick("MultipleChoice", ["x"], "x")).toEqual([]);
  });

  it("does not change the list it was given", () => {
    const current = ["x"];
    selectionAfterClick("MultipleChoice", current, "y");
    expect(current).toEqual(["x"]);
  });
});

describe("the countdown", () => {
  const deadline = "2026-11-05T10:10:00.000Z";

  it("counts from the clock of the server, not from the clock of the device", () => {
    // the server says it is 10:00:00 and the device thinks it is 09:00:00 (an hour slow)
    const device = new Date("2026-11-05T09:00:00.000Z").getTime();
    const offset = clockOffsetMs("2026-11-05T10:00:00.000Z", device);
    expect(offset).toBe(3_600_000);
    expect(secondsLeft(deadline, device, offset)).toBe(600);
    // 90 seconds later on the device
    expect(secondsLeft(deadline, device + 90_000, offset)).toBe(510);
  });

  it("never goes below zero and rounds up, so 0 means the time is really over", () => {
    const now = new Date(deadline).getTime();
    expect(secondsLeft(deadline, now, 0)).toBe(0);
    expect(secondsLeft(deadline, now + 5000, 0)).toBe(0);
    expect(secondsLeft(deadline, now - 400, 0)).toBe(1);
  });

  it("is written as m:ss, and h:mm:ss from an hour", () => {
    expect(formatCountdown(0)).toBe("0:00");
    expect(formatCountdown(9)).toBe("0:09");
    expect(formatCountdown(65)).toBe("1:05");
    expect(formatCountdown(600)).toBe("10:00");
    expect(formatCountdown(3723)).toBe("1:02:03");
    expect(formatCountdown(-5)).toBe("0:00");
  });
});

describe("what the Learner reads", () => {
  it("scores use a comma and at most two decimals", () => {
    expect(formatPercentageVN(50)).toBe("50%");
    expect(formatPercentageVN(66.67)).toBe("66,67%");
    expect(formatPercentageVN(100)).toBe("100%");
    expect(formatPercentageVN(0)).toBe("0%");
  });

  it("the type of a question is in Vietnamese", () => {
    expect(questionTypeLabel("SingleChoice")).toBe("Một đáp án");
    expect(questionTypeLabel("MultipleChoice")).toBe("Nhiều đáp án");
    expect(questionTypeLabel("TrueFalse")).toBe("Đúng / Sai");
  });

  it("every code of the server has a Vietnamese text, an unknown one gets the fallback", () => {
    for (const code of [
      "ASSESSMENT_LOCKED",
      "ASSESSMENT_DISABLED",
      "ENROLLMENT_COMPLETED",
      "ENROLLMENT_NOT_ACTIVE",
      "NOT_ENROLLED",
      "QUIZ_NOT_FOUND",
      "ATTEMPT_NOT_FOUND",
      "QUIZ_HAS_NO_QUESTIONS",
      "QUIZ_HAS_NO_TIME_LIMIT",
      "ATTEMPT_EXPIRED",
      "ATTEMPT_SUBMITTED",
      "OPTION_NOT_IN_QUESTION",
      "TOO_MANY_OPTIONS",
      "QUESTION_NOT_FOUND",
    ]) {
      const text = quizErrorText(code, "fallback");
      expect(text).not.toBe("fallback");
      expect(text).toMatch(
        /[ạảãàáâấầẩẫăắằẳẵặẹẻẽèéêếềểễệỉĩịọỏõòóôốồổỗộơớờởỡợụủũùúưứừửữựỳỷỹýđ]/i,
      );
    }
    expect(quizErrorText("SOMETHING_NEW", "Có lỗi.")).toBe("Có lỗi.");
    expect(quizErrorText(undefined, "Có lỗi.")).toBe("Có lỗi.");
  });

  it("the two codes that mean 'the page is out of date' are the ones that reload the attempt", () => {
    expect(QUIZ_STALE_CODES).toEqual(["ATTEMPT_EXPIRED", "ATTEMPT_SUBMITTED"]);
  });
});
