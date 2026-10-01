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
    expect(LEARNER_ROUTES.lesson("e-1", "l 1")).toBe("/learner/courses/e-1/lessons/l%201");
  });
});
