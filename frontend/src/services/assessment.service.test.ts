import fs from "node:fs";
import { describe, expect, it, vi } from "vitest";

// the client wants the environment of a running app: replace it with a recorder of the calls
const http = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));
vi.mock("./axios.customize", () => ({ assessmentAxios: http, default: http }));

import * as service from "./assessment.service";
import { ENROLLMENT_NOT_ACTIVE_FORM_TEXT, assessmentErrorText } from "./assessment.service";

const refused = (code: string, message = "An English message from the server.") => ({
  statusCode: 409,
  error: { code, message },
});

describe("assessmentErrorText", () => {
  it("shows the Learner a Vietnamese text when the Enrollment is not active, whatever the server wrote", () => {
    const text = assessmentErrorText(refused("ENROLLMENT_NOT_ACTIVE"), "fallback");
    expect(text).toContain("Khóa học đã tạm dừng");
    expect(text).toContain("Quản lý đào tạo");
    expect(text).not.toContain("English");
  });

  it("does not promise a draft on the screens that have none (the list and the result)", () => {
    expect(assessmentErrorText(refused("ENROLLMENT_NOT_ACTIVE"), "fallback")).not.toContain("giữ");
  });

  it("has its own text for the form, which promises that what the Learner typed is kept", () => {
    expect(ENROLLMENT_NOT_ACTIVE_FORM_TEXT).toContain("Nội dung bạn đã nhập vẫn được giữ trên trang này");
    expect(ENROLLMENT_NOT_ACTIVE_FORM_TEXT).toContain("Hãy liên hệ Quản lý đào tạo");
  });

  it("leaves every other answer as it was: the server message, then the fallback", () => {
    expect(assessmentErrorText(refused("ASSESSMENT_LOCKED", "Locked until noon."), "fallback")).toBe("Locked until noon.");
    expect(assessmentErrorText({ statusCode: 500 }, "fallback")).toBe("fallback");
    expect(assessmentErrorText({ message: ["a", "b"] }, "fallback")).toBe("a b");
  });
});

/** The identity belongs to the gateway (from the JWT): a browser must never send the internal key or a fixed identity. */
describe("what the assessment service sends from the browser", () => {
  const IDENTITY_HEADERS = ["x-internal-key", "x-user-id", "x-organization-id", "x-user-role", "x-dev-user-id"];

  it("sends none of the internal or identity headers, from any of its calls", async () => {
    for (const method of Object.values(http)) method.mockReset().mockResolvedValue({ status: 200, data: {} });
    const calls = Object.entries(service).filter(
      (entry): entry is [string, (...args: unknown[]) => unknown] =>
        entry[0].endsWith("API") && typeof entry[1] === "function",
    );
    expect(calls.length).toBeGreaterThan(15); // the guard sees the whole service, not an empty list
    for (const [, call] of calls) {
      try {
        await call("id-1", "id-2", "id-3");
      } catch {
        // some calls need real arguments (a file, a payload); what they sent before that is still checked
      }
    }
    const sent = Object.values(http).flatMap((method) => method.mock.calls);
    expect(sent.length).toBeGreaterThan(15);
    for (const args of sent) {
      for (const arg of args) {
        const headers = (arg as { headers?: Record<string, unknown> } | undefined)?.headers ?? {};
        const names = Object.keys(headers).map((name) => name.toLowerCase());
        for (const forbidden of IDENTITY_HEADERS) expect(names).not.toContain(forbidden);
      }
    }
  });

  it("does not carry a default internal key anywhere in the module", () => {
    const text = fs.readFileSync(new URL("./assessment.service.ts", import.meta.url), "utf8");
    expect(text).not.toMatch(/learnup-internal-secret/);
    expect(text).not.toMatch(/x-internal-keys*["']s*:/i);
  });
});

describe("the peer review calls of the Instructor (UC33.1, UC33.2)", () => {
  it("reads one cycle of an Assignment", async () => {
    http.get.mockReset().mockResolvedValue({ statusCode: 200, data: {} });
    await service.fetchPeerReviewCycleDetailAPI("assignment-1", "cycle-1");
    expect(http.get).toHaveBeenCalledWith("/api/v1/assessments/assignments/assignment-1/peer-review/cycles/cycle-1");
  });

  it("waives the duty of one Learner with a POST and no body", async () => {
    http.post.mockReset().mockResolvedValue({ statusCode: 200, data: {} });
    await service.waivePeerReviewDutyAPI("assignment-1", "learner-1");
    expect(http.post).toHaveBeenCalledTimes(1);
    expect(http.post.mock.calls[0]).toEqual([
      "/api/v1/assessments/assignments/assignment-1/peer-review/learners/learner-1/waiver",
    ]);
  });
});
