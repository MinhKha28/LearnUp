import { describe, expect, it } from "vitest";
import { assignmentDateOnly, assignmentTimestamp, assignmentDueDate, assignmentDueNote } from "./assignment.date";
import { formatDueAt } from "./due.format";

describe("organizer dates", () => {
  it("formats a date and timestamp with two-digit parts and a full year", () => {
    expect(assignmentDateOnly("2026-01-03T01:09:00Z", "Asia/Ho_Chi_Minh")).toBe("03/01/2026");
    expect(assignmentTimestamp("2026-01-03T01:09:00Z", "Asia/Ho_Chi_Minh")).toBe("03/01/2026 08:09");
  });
  it("shows the last eligible day before midnight at +07:00", () => {
    const midnight = "2026-10-17T00:00:00+07:00";
    expect(assignmentDueDate(midnight, "Asia/Ho_Chi_Minh")).toBe("16/10/2026");
    expect(assignmentDateOnly(midnight, "Asia/Ho_Chi_Minh")).toBe("17/10/2026");
    expect(formatDueAt(midnight, "Asia/Ho_Chi_Minh").text).toBe("Hết ngày 16/10/2026");
  });
  it("retains the current day for a non-midnight deadline", () => {
    expect(assignmentDueDate("2026-10-17T01:00:00+07:00", "Asia/Ho_Chi_Minh")).toBe("17/10/2026");
  });
  it("uses the organization's date across UTC and year boundaries", () => {
    expect(assignmentDueDate("2026-01-01T00:00:00+07:00", "Asia/Ho_Chi_Minh")).toBe("31/12/2025");
    expect(assignmentDueDate("2026-10-17T04:00:00Z", "America/New_York")).toBe("16/10/2026");
  });
  it.each([null, "invalid"])("handles missing or invalid dates %s", value => {
    expect(assignmentDateOnly(value, null)).toBe("—");
    expect(assignmentTimestamp(value, null)).toBe("—");
    expect(assignmentDueDate(value, null)).toBe("—");
  });
  it("preserves the shared device-time fallback when timezone is unavailable", () => {
    const value = "2026-10-16T17:00:00Z";
    expect(assignmentDueDate(value, null)).toBe(formatDueAt(value, null).text.match(/\d{2}\/\d{2}\/\d{4}/)?.[0]);
    expect(assignmentDueNote(null)).toContain("giờ trên máy bạn");
    expect(assignmentDueNote("invalid")).toContain("giờ trên máy bạn");
    expect(assignmentDueNote("Asia/Ho_Chi_Minh")).toBe("Tính đến hết ngày theo giờ tổ chức (Asia/Ho_Chi_Minh)");
  });
});
