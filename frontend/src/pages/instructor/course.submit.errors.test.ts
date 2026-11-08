import { describe, expect, it } from "vitest";
import { getSubmitErrorCode, getSubmitErrorMessage } from "./course.submit.errors";

describe("UC20 submit response error mapping", () => {
  it.each([
    ["INCOMPLETE_COURSE", "Please complete all required Course information before submission."],
    ["QUIZ_WITHOUT_QUESTIONS", "One or more Quizzes have no questions. Please review them before submitting."],
    ["COURSE_CHANGED", "This Course has been modified. Please reload and try again."],
    ["ASSESSMENT_UNAVAILABLE", "Unable to validate Course Quizzes. Please try again later."],
    ["INVALID_ASSESSMENT_RESPONSE", "Unable to validate Course Quizzes. Please try again later."],
    ["INVALID_COURSE_STATUS", "Only Draft or Rejected Courses can be submitted."],
  ])("maps %s to the expected English message", (code, expected) => {
    expect(getSubmitErrorMessage({ statusCode: 409, code })).toBe(expected);
  });

  it("supports a nested error code returned by the API", () => {
    expect(getSubmitErrorCode({ statusCode: 400, error: { code: "INCOMPLETE_COURSE" } }))
      .toBe("INCOMPLETE_COURSE");
  });

  it("supports a rejected Axios response", () => {
    expect(getSubmitErrorCode({ response: { data: { code: "COURSE_CHANGED" } } }))
      .toBe("COURSE_CHANGED");
  });

  it("keeps a safe fallback for unknown errors", () => {
    expect(getSubmitErrorMessage({ statusCode: 503, error: "Server failure" }))
      .toBe("Unable to submit Course. Please try again.");
    expect(getSubmitErrorMessage(null)).toBe("Unable to submit Course. Please try again.");
  });
});
