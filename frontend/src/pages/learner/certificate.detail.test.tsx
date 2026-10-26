import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/types/api.types";
const state = vi.hoisted(() => ({ query: {} as Record<string, unknown> }));
vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ certificateId: "owned-id" }),
}));
vi.mock("@/hooks/use.api.query", () => ({
  useApiQuery: () => ({ ...state.query, reload: vi.fn() }),
}));
vi.mock("@/hooks/use.certificate.download", () => ({
  useCertificateDownload: () => ({
    busy: new Set(),
    messages: {},
    download: vi.fn(),
  }),
}));
import CertificateDetail from "./certificate.detail";
beforeEach(() => {
  state.query = { status: "loading", data: null, error: null };
});
describe("certificate detail states", () => {
  it("announces initial loading", () => {
    expect(renderToStaticMarkup(<CertificateDetail />)).toContain("Đang tải");
  });
  it("renders a clear private not-found message", () => {
    state.query = {
      status: "error",
      data: null,
      error: new ApiError(404, "CERTIFICATE_NOT_FOUND", ""),
    };
    expect(renderToStaticMarkup(<CertificateDetail />)).toContain(
      "Không tìm thấy chứng chỉ",
    );
  });
  it("renders a retryable network error", () => {
    state.query = {
      status: "error",
      data: null,
      error: new ApiError(0, "NETWORK", ""),
    };
    expect(renderToStaticMarkup(<CertificateDetail />)).toContain("Thử lại");
  });
  it("shows frozen recipient, organization, version, late status, signer and server date", () => {
    state.query = {
      status: "success",
      data: {
        recipient: "Nguyễn Thị Ánh",
        organizationName: "Tổ chức A",
        courseTitle: "An toàn lao động",
        versionNumber: 2,
        issuedDate: "2026-11-01",
        issuedAt: "2026-10-31T23:00:00Z",
        certificateCode: "0123-4567-89AB",
        completedLate: true,
        signerName: "Trần Bình",
        signerTitle: "Giám đốc",
      },
    };
    const html = renderToStaticMarkup(<CertificateDetail />);
    for (const text of [
      "Nguyễn Thị Ánh",
      "Tổ chức A",
      "An toàn lao động",
      "Phiên bản 2",
      "01/11/2026",
      "0123-4567-89AB",
      "Hoàn thành sau hạn",
      "Trần Bình",
      "Giám đốc",
    ])
      expect(html).toContain(text);
    expect(html).not.toContain("Alex Morgan");
    expect(html).not.toContain("31/10/2026");
  });
});
