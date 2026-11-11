import { describe, expect, it, vi } from "vitest";

import axios from "@/services/axios.customize";
import { buildAuditParams, fetchAuditLogsAPI } from "./audit.service";

vi.mock("@/services/axios.customize", () => ({ default: { get: vi.fn() } }));

describe("buildAuditParams", () => {
  it("sends only the page and the size when nothing is filtered, and the page starts at 0 on the server", () => {
    expect(buildAuditParams({ page: 1 })).toEqual({ page: 0, size: 20 });
    expect(buildAuditParams({ page: 3, pageSize: 50 })).toEqual({ page: 2, size: 50 });
  });

  it("sends the target as it is and the days as the instants of Vietnam time, the last day until the start of the next", () => {
    expect(
      buildAuditParams({ page: 2, targetResourceType: "User", targetResourceId: "abc", from: "2026-11-01", to: "2026-11-08" }),
    ).toEqual({
      page: 1,
      size: 20,
      targetResourceType: "User",
      targetResourceId: "abc",
      from: "2026-10-31T17:00:00.000Z",
      to: "2026-11-08T17:00:00.000Z",
    });
  });

  it("never sends an Organization (the server decides the scope from who the caller is)", () => {
    const params = buildAuditParams({ page: 1, targetResourceType: "User" }) as Record<string, unknown>;
    expect(params).not.toHaveProperty("organizationId");
  });

  it("leaves out empty filters", () => {
    expect(buildAuditParams({ page: 1, targetResourceType: "", targetResourceId: "", from: "", to: "" })).toEqual({ page: 0, size: 20 });
  });
});

describe("fetchAuditLogsAPI", () => {
  it("asks the audit route of the gateway with the built query and the signal", async () => {
    const get = vi.mocked(axios.get);
    get.mockResolvedValue({ success: true } as never);
    const signal = new AbortController().signal;
    await fetchAuditLogsAPI({ page: 2, targetResourceId: "abc" }, signal);
    expect(get).toHaveBeenCalledWith("/api/v1/audit/logs", { params: { page: 1, size: 20, targetResourceId: "abc" }, signal });
  });
});
