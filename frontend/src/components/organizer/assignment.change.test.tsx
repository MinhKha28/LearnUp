import { afterEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AssignmentChange } from "./assignment.change";
import type { AssignmentDetail } from "@/types/assignment.types";
import * as views from "@/utils/assignments.view";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it("UC24.3 passes the item's frozen zone to the picker range despite a changed organization zone", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-29T12:00:00Z"));
  const range = vi.spyOn(views, "assignmentExtensionRange");
  const item: AssignmentDetail & { organizationTimezone: string } = {
    enrollmentId: "enrollment", learner: null, course: null, assignedAt: null,
    dueAt: "2026-10-29T17:00:00Z", dueTimezone: "Asia/Ho_Chi_Minh",
    organizationTimezone: "Pacific/Auckland", status: "NotStarted",
    requiredCompleted: 0, requiredTotal: 1, baseDueAt: "2026-10-29T17:00:00Z",
    extensionSeconds: 0, firstActivityAt: null, completedAt: null, completedLate: null,
    withdrawnAt: null, withdrawnReason: null, intervals: [],
  };
  renderToStaticMarkup(<AssignmentChange item={item} onChanged={() => undefined} onConflict={() => undefined} />);
  expect(range).toHaveBeenCalledWith(item.dueAt, item.dueTimezone);
  expect(range.mock.results[0].value).toEqual({ min: "2026-10-30" });
});
