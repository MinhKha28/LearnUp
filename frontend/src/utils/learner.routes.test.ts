import { describe, expect, it } from "vitest";

import { LEARNER_ROUTES } from "@/utils/learner.routes";

describe("LEARNER_ROUTES", () => {
  it("dựng đường dẫn và mã hóa tham số", () => {
    expect(LEARNER_ROUTES.myCourses()).toBe("/learner/courses");
    expect(LEARNER_ROUTES.catalog()).toBe("/learner/catalog");
    expect(LEARNER_ROUTES.catalog(1)).toBe("/learner/catalog");
    expect(LEARNER_ROUTES.catalog(3)).toBe("/learner/catalog?page=3");
    expect(LEARNER_ROUTES.courseIntro("c/1")).toBe("/learner/catalog/c%2F1");
    expect(LEARNER_ROUTES.curriculum("e-1")).toBe("/learner/courses/e-1");
    expect(LEARNER_ROUTES.lesson("e-1", "l 1")).toBe(
      "/learner/courses/e-1/lessons/l%201",
    );
    expect(LEARNER_ROUTES.assessments("e-1")).toBe(
      "/learner/courses/e-1/assessments",
    );
    expect(LEARNER_ROUTES.results("e/1")).toBe(
      "/learner/courses/e%2F1/results",
    );
    expect(LEARNER_ROUTES.quiz("e-1", "q 1")).toBe(
      "/learner/courses/e-1/quizzes/q%201",
    );
    expect(LEARNER_ROUTES.quizHistory("e-1", "q-1")).toBe(
      "/learner/courses/e-1/quizzes/q-1/history",
    );
    expect(LEARNER_ROUTES.assignmentResult("e-1", "a-1")).toBe(
      "/learner/courses/e-1/assignments/a-1/result",
    );
    expect(LEARNER_ROUTES.assignmentSubmit("e-1", "a-1")).toBe(
      "/learner/courses/e-1/assignments/a-1/submit",
    );
  });
});
