import { describe, expect, it } from "vitest";
import { getSubmitErrorCode, getSubmitErrorMessage } from "./course.submit.errors";

describe("UC20 submit response error mapping", () => {
  it.each([
    ["INCOMPLETE_COURSE", "Vui lòng hoàn thiện thông tin khóa học bắt buộc trước khi gửi phê duyệt."],
    ["QUIZ_WITHOUT_QUESTIONS", "Một hoặc nhiều bài trắc nghiệm chưa có câu hỏi. Vui lòng kiểm tra trước khi gửi phê duyệt."],
    ["COURSE_CHANGED", "Khóa học đã có thay đổi. Vui lòng tải lại trang và thử lại."],
    ["ASSESSMENT_UNAVAILABLE", "Không thể xác minh bài trắc nghiệm của khóa học. Vui lòng thử lại sau."],
    ["INVALID_ASSESSMENT_RESPONSE", "Không thể xác minh bài trắc nghiệm của khóa học. Vui lòng thử lại sau."],
    ["INVALID_COURSE_STATUS", "Chỉ có thể gửi phê duyệt khóa học ở trạng thái bản nháp hoặc bị từ chối."],
  ])("maps %s to the expected Vietnamese message", (code, expected) => {
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
      .toBe("Không thể gửi khóa học phê duyệt. Vui lòng thử lại.");
    expect(getSubmitErrorMessage(null)).toBe("Không thể gửi khóa học phê duyệt. Vui lòng thử lại.");
  });
});
