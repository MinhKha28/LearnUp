import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/types/api.types";
const api = vi.hoisted(() => ({ apiGet: vi.fn(), apiGetWithHeaders: vi.fn() }));
vi.mock("./api.client", () => api);
import {
  certificateDate,
  certificateFilename,
  downloadCertificate,
  getCertificate,
  getCertificates,
} from "./achievement.service";
afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});
describe("learner certificate service", () => {
  it("uses server calendar date without recomputing the instant", () => {
    expect(certificateDate("2026-11-01")).toBe("01/11/2026");
  });
  it("sends scoped routes and the opaque cursor through the authenticated API client", async () => {
    const signal = new AbortController().signal;
    await getCertificates("opaque", signal);
    await getCertificate("a/b", signal);
    expect(api.apiGet).toHaveBeenNthCalledWith(1, "/api/v1/certificates/me", {
      params: { cursor: "opaque" },
      signal,
    });
    expect(api.apiGet).toHaveBeenNthCalledWith(
      2,
      "/api/v1/certificates/me/a%2Fb",
      { signal },
    );
  });
  it("prefers RFC 5987 filenames, handles malformed encoding, and rejects unsafe names", () => {
    expect(
      certificateFilename(
        `attachment; filename="ascii.pdf"; filename*=UTF-8''Ch%E1%BB%A9ng.pdf`,
      ),
    ).toBe("Chứng.pdf");
    expect(
      certificateFilename(
        `attachment; filename="ascii.pdf"; filename*=UTF-8''%XX`,
      ),
    ).toBe("ascii.pdf");
    for (const header of [
      'attachment; filename="../secret.pdf"',
      'attachment; filename="x.txt"',
      undefined,
    ])
      expect(certificateFilename(header)).toBe("chung-chi.pdf");
  });
  it("retries 503 exactly twice at one then two seconds and returns the PDF blob and filename", async () => {
    vi.useFakeTimers();
    const blob = new Blob(["%PDF"]);
    api.apiGetWithHeaders
      .mockRejectedValueOnce(new ApiError(503, "SERVICE_UNAVAILABLE", ""))
      .mockRejectedValueOnce(new ApiError(503, "SERVICE_UNAVAILABLE", ""))
      .mockResolvedValueOnce({
        data: blob,
        headers: { "content-disposition": 'attachment; filename="ABCD.pdf"' },
      });
    const promise = downloadCertificate("id", new AbortController().signal);
    await vi.advanceTimersByTimeAsync(999);
    expect(api.apiGetWithHeaders).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(api.apiGetWithHeaders).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1999);
    expect(api.apiGetWithHeaders).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(await promise).toEqual({ blob, filename: "ABCD.pdf" });
    expect(api.apiGetWithHeaders.mock.calls[0][1].responseType).toBe("blob");
  });
  it("stops after three busy responses", async () => {
    vi.useFakeTimers();
    api.apiGetWithHeaders.mockRejectedValue(
      new ApiError(503, "SERVICE_UNAVAILABLE", ""),
    );
    const promise = expect(
      downloadCertificate("id", new AbortController().signal),
    ).rejects.toMatchObject({ status: 503 });
    await vi.advanceTimersByTimeAsync(3000);
    await promise;
    expect(api.apiGetWithHeaders).toHaveBeenCalledTimes(3);
  });
  it.each([0, 404])(
    "does not retry network/not-found errors (%s)",
    async (status) => {
      api.apiGetWithHeaders.mockRejectedValue(
        new ApiError(status, "ERROR", ""),
      );
      await expect(
        downloadCertificate("id", new AbortController().signal),
      ).rejects.toMatchObject({ status });
      expect(api.apiGetWithHeaders).toHaveBeenCalledTimes(1);
    },
  );
  it("cancels the retry delay when the page unmounts", async () => {
    vi.useFakeTimers();
    api.apiGetWithHeaders.mockRejectedValue(
      new ApiError(503, "SERVICE_UNAVAILABLE", ""),
    );
    const controller = new AbortController();
    const result = expect(
      downloadCertificate("id", controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(1);
    controller.abort();
    await result;
    await vi.advanceTimersByTimeAsync(4000);
    expect(api.apiGetWithHeaders).toHaveBeenCalledTimes(1);
  });
});
