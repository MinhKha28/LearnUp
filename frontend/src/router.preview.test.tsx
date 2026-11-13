// @vitest-environment jsdom
import { isValidElement } from "react";
import { matchRoutes, Navigate, type RouteObject } from "react-router-dom";
import { afterAll, describe, expect, it, vi } from "vitest";


const previewPaths = [
  "/learner/courses/:enrollmentId/evaluation",
  "/learner/courses/:enrollmentId/lessons/:lessonId/resources/:resourceId/report",
  "/learner/reports",
  "/learner/reports/:reportId/escalate",
  "/learner/courses/:enrollmentId/assignments/:assignmentId",
  "/learner/subscription-suspended",
  "/instructor/courses/:courseId/delete-blocked",
  "/instructor/courses/:courseId/versions",
  "/instructor/courses/:courseId/versions/new",
  "/instructor/courses/:courseId/builder/new-version",
  "/instructor/submissions/:submissionId/discrepancy",
  "/instructor/monitoring",
  "/instructor/monitoring/filters",
  "/instructor/monitoring/export",
  "/instructor/monitoring/courses/:courseId/learners/:learnerId",
  "/instructor/evaluations",
  "/instructor/evaluations/comments",
  "/instructor/evaluations/export",
  "/instructor/courses/:courseId/content-review",
  "/instructor/courses/:courseId/content-review/reconsider",
  "/instructor/courses/:courseId/content-review/escalate",
  "/instructor/courses/:courseId/builder/modules/:moduleId/delete",
  "/instructor/courses/:courseId/builder/lessons/:lessonId/delete",
  "/instructor/courses/:courseId/builder/lessons/:lessonId/materials/:materialId/delete",
  "/instructor/courses/:courseId/builder/lessons/:lessonId/materials/:materialId/delete-blocked",
  "/instructor/courses/:courseId/builder/quizzes/:quizId/questions/:questionId/edit",
  "/organizer/learners/:learnerId/report",
  "/organizer/courses/:courseId/version-report",
  "/organizer/reports",
  "/organizer/reports/:reportId",
  "/organizer/evaluations",
  "/organizer/content-reports",
  "/organizer/content-reports/:reportId",
  "/organizer/violation-history",
  "/admin/organizations/:organizationId/replace-organizer",
  "/admin/plans/:planId/edit",
  "/admin/reports",
  "/admin/reports/:reportId",
  "/admin/configuration",
  "/admin/statistics",
  "/admin/suspended-organizations",
];

vi.mock("react-router-dom", async (importOriginal) => ({
  ...await importOriginal<typeof import("react-router-dom")>(),
  createBrowserRouter: vi.fn(),
}));

vi.mock("@/config/env", () => ({
  env: { backendUrl: { tenant: "/", course: "/", assessment: "/" } },
}));

async function loadRoutes(flag: string) {
  vi.stubEnv("VITE_ENABLE_PREVIEW_PAGES", flag);
  vi.resetModules();
  return (await import("./router")).appRoutes;
}

const previewOff = await loadRoutes("false");
const previewOn = await loadRoutes("true");
const notFound = previewOff.find((route) => route.path === "*")?.element;

afterAll(() => vi.unstubAllEnvs());

const leaf = (routes: RouteObject[], url: string) =>
  matchRoutes(routes, url)?.at(-1)?.route;

describe("preview route table", () => {
  it.each(previewPaths)("omits %s with preview off and registers it with preview on", (pattern) => {
    const url = pattern.replace(/:\w+/g, "test-id");
    const disabled = leaf(previewOff, url);
    const enabled = leaf(previewOn, url);
    expect(disabled?.path).toBe("*");
    expect(disabled?.element).toBe(notFound);
    expect(enabled?.path).not.toBe("*");
    expect(isValidElement(enabled?.element)).toBe(true);
  });

  it.each([
    ["/learner", "/learner/courses"],
    ["/instructor", "/instructor/courses"],
    ["/organizer", "/organizer/learners"],
    ["/admin", "/admin/organizations"],
  ])("uses the real landing from %s with preview off", (root, target) => {
    const disabled = leaf(previewOff, root);
    const enabled = leaf(previewOn, root);
    expect(disabled?.index).toBe(true);
    expect(disabled?.element).toMatchObject({ type: Navigate, props: { to: target, replace: true } });
    expect(leaf(previewOff, target)?.path).toBe(target.split("/").at(-1));
    expect(enabled?.index).toBe(true);
    expect(isValidElement(enabled?.element) && enabled.element.type).not.toBe(Navigate);
  });

  it("uses the not-found page for draft-created without falling through to a real course", () => {
    const url = "/instructor/courses/draft-created";
    const fallback = leaf(previewOff, url)?.element;
    expect(isValidElement(fallback) && isValidElement(notFound) && fallback.type === notFound.type).toBe(true);
    expect(leaf(previewOn, url)?.path).toBe("courses/draft-created");
    expect(leaf(previewOff, "/instructor/courses/test-id")?.path).toBe("courses/:courseId");
  });

  it("preserves the out-of-scope course quota screen and real assignment actions", () => {
    for (const url of [
      "/instructor/courses/create/quota-blocked",
      "/learner/courses/e/assignments/a/submit",
      "/learner/courses/e/assignments/a/resubmit",
      "/learner/courses/e/assignments/a/submitted",
      "/learner/courses/e/assignments/a/result",
    ]) {
      expect(leaf(previewOff, url)?.path).toBe(leaf(previewOn, url)?.path);
      expect(leaf(previewOff, url)?.path).not.toBe("*");
    }
  });
});
