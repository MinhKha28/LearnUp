import { describe, expect, it, vi } from "vitest";

// the text helpers do not need the HTTP client, and the client wants the environment of a running app
vi.mock("./axios.customize", () => ({ default: {} }));

import { ENROLLMENT_NOT_ACTIVE_FORM_TEXT, assessmentErrorText } from "./assessment.service";

const refused = (code: string, message = "An English message from the server.") => ({
  statusCode: 409,
  error: { code, message },
});

describe("assessmentErrorText", () => {
  it("shows the Learner a Vietnamese text when the Enrollment is not active, whatever the server wrote", () => {
    const text = assessmentErrorText(refused("ENROLLMENT_NOT_ACTIVE"), "fallback");
    expect(text).toContain("Khóa học đã tạm dừng");
    expect(text).toContain("Quản lý đào tạo");
    expect(text).not.toContain("English");
  });

  it("does not promise a draft on the screens that have none (the list and the result)", () => {
    expect(assessmentErrorText(refused("ENROLLMENT_NOT_ACTIVE"), "fallback")).not.toContain("giữ");
  });

  it("has its own text for the form, which promises that what the Learner typed is kept", () => {
    expect(ENROLLMENT_NOT_ACTIVE_FORM_TEXT).toContain("Nội dung bạn đã nhập vẫn được giữ trên trang này");
    expect(ENROLLMENT_NOT_ACTIVE_FORM_TEXT).toContain("Hãy liên hệ Quản lý đào tạo");
  });

  it("leaves every other answer as it was: the server message, then the fallback", () => {
    expect(assessmentErrorText(refused("ASSESSMENT_LOCKED", "Locked until noon."), "fallback")).toBe("Locked until noon.");
    expect(assessmentErrorText({ statusCode: 500 }, "fallback")).toBe("fallback");
    expect(assessmentErrorText({ message: ["a", "b"] }, "fallback")).toBe("a b");
  });
});
