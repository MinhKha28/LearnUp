import { describe, expect, it } from "vitest";
import { courseTrashErrorMessage } from "./course-trash";

describe("courseTrashErrorMessage", () => {
  it.each([
    ["delete", "COURSE_NOT_FOUND", "Course not found or you do not have access."],
    ["delete", "COURSE_NOT_DELETABLE", "Only Draft or Rejected Courses can be deleted."],
    ["delete", "COURSE_LOCKED", "This Course is locked and cannot be deleted."],
    ["delete", "COURSE_HAS_ENROLLMENT", "This Course has enrollment history and cannot be deleted."],
    ["delete", "ENROLLMENT_CHECK_UNAVAILABLE", "Enrollment history could not be verified. Please try again later."],
    ["restore", "COURSE_NOT_FOUND", "Course not found or you do not have access."],
    ["restore", "COURSE_DRAFT_VERSION_CONFLICT", "This Course cannot be restored because another Draft, Submitted, or Rejected version exists in the same chain."],
    ["restore", "COURSE_TRASH_EXPIRED", "The 7-day recovery period has expired."],
    ["permanent", "COURSE_NOT_FOUND", "Course not found or you do not have access."],
    ["permanent", "COURSE_NOT_IN_TRASH", "This Course is not in Trash."],
  ] as const)("maps %s failure %s", (action, code, message) => {
    expect(courseTrashErrorMessage(code, action)).toBe(message);
  });

  it("uses the permanent deletion fallback for the retired code", () => {
    expect(
      courseTrashErrorMessage("COURSE_DELETION_IN_PROGRESS", "permanent"),
    ).toBe("Unable to permanently delete this Course. Please try again.");
  });
});
