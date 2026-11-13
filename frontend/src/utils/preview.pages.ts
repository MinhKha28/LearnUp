import type { MenuProps } from "antd";
import { matchPath } from "react-router-dom";

export const previewPagesEnabled = import.meta.env.VITE_ENABLE_PREVIEW_PAGES === "true";

export const previewLandings: Readonly<Record<string, string>> = {
  "/admin": "/admin/organizations",
  "/organizer": "/organizer/learners",
  "/learner": "/learner/courses",
  "/instructor": "/instructor/courses",
};

const previewPaths = new Set([
  ...Object.keys(previewLandings),
  "/learner/courses/:enrollmentId/evaluation",
  "/learner/courses/:enrollmentId/lessons/:lessonId/resources/:resourceId/report",
  "/learner/reports",
  "/learner/reports/:reportId/escalate",
  "/learner/courses/:enrollmentId/assignments/:assignmentId",
  "/learner/subscription-suspended",
  "/instructor/courses/draft-created",
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
]);

export const isPreviewRoute = (pattern: string) => previewPaths.has(pattern);

export const canOpenPage = (url: string) => {
  if (previewPagesEnabled) return true;
  try {
    const origin = "https://learnup.invalid";
    const target = new URL(url, origin);
    return target.origin === origin &&
      ![...previewPaths].some((pattern) => matchPath(pattern, target.pathname));
  } catch {
    return false;
  }
};

type RoleMenuItems = NonNullable<MenuProps["items"]>;

export const visibleRoleMenu = (items: RoleMenuItems): RoleMenuItems =>
  previewPagesEnabled ? items : items.flatMap<RoleMenuItems[number]>((item) => {
    if (!item) return [];
    if (item.type === "group") {
      const children = visibleRoleMenu(item.children ?? []);
      return children?.length ? [{ ...item, children }] : [];
    }
    return typeof item.key === "string" && !canOpenPage(item.key) ? [] : [item];
  });
