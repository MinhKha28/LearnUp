import { describe, expect, it } from "vitest";
import {
  BYTES_PER_GB,
  organizationsUsingLabel,
  PLAN_LIMITS,
  planErrorMessage,
  toCreatePlanBody,
} from "./plan.view";

describe("UC43 / UC43.1 plan view", () => {
  it("sends storage in bytes and a normalised name", () => {
    expect(
      toCreatePlanBody({
        name: "  Growth   Plus ",
        price: 4990000,
        durationDays: 180,
        maxLearners: 500,
        maxInstructors: 25,
        maxCourseChains: 50,
        storageGb: 120,
      }),
    ).toEqual({
      name: "Growth Plus",
      price: 4990000,
      durationDays: 180,
      maxLearners: 500,
      maxInstructors: 25,
      maxCourseChains: 50,
      maxStorageBytes: 120 * BYTES_PER_GB,
    });
  });

  it("rounds fractional gigabytes to whole bytes", () => {
    const body = toCreatePlanBody({
      name: "Small",
      price: 0,
      durationDays: 30,
      maxLearners: 1,
      maxInstructors: 1,
      maxCourseChains: 1,
      storageGb: 0.5,
    });
    expect(body.maxStorageBytes).toBe(BYTES_PER_GB / 2);
    expect(Number.isInteger(body.maxStorageBytes)).toBe(true);
  });

  it("stays a safe positive integer at the storage bounds of the form", () => {
    const bytes = (storageGb: number) =>
      toCreatePlanBody({
        name: "Bound",
        price: 0,
        durationDays: 1,
        maxLearners: 1,
        maxInstructors: 1,
        maxCourseChains: 1,
        storageGb,
      }).maxStorageBytes;
    expect(bytes(PLAN_LIMITS.minStorageGb)).toBe(107_374_182);
    const largest = bytes(PLAN_LIMITS.maxStorageGb);
    expect(Number.isSafeInteger(largest)).toBe(true);
    expect(largest).toBe(PLAN_LIMITS.maxStorageGb * BYTES_PER_GB);
    expect(bytes(PLAN_LIMITS.maxStorageGb + 1)).toBeGreaterThan(
      Number.MAX_SAFE_INTEGER,
    );
  });

  it("maps backend errors without showing raw codes", () => {
    expect(planErrorMessage(409, "PLAN_NAME_TAKEN")).toBe(
      "A plan with this name already exists.",
    );
    expect(planErrorMessage(400, undefined)).toContain("not valid");
    expect(planErrorMessage(403, "FORBIDDEN")).toContain(
      "Only platform Admins",
    );
    expect(planErrorMessage(500, "INTERNAL_SERVER_ERROR")).not.toContain(
      "INTERNAL",
    );
  });

  it("describes how many Organizations use a plan", () => {
    expect(organizationsUsingLabel(0)).toBe(
      "No Organization is using this plan",
    );
    expect(organizationsUsingLabel(1)).toBe("1 Organization currently using");
    expect(organizationsUsingLabel(7)).toBe("7 Organizations currently using");
  });
});
