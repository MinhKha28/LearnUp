// @vitest-environment jsdom
// The prompt file field (BR-320): the size limit comes from the API, so a file over it is refused before any upload.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/services/axios.customize", () => ({ assessmentAxios: {}, default: {} }));
vi.mock("@/services/assessment.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/assessment.service")>()),
  getPromptFileLimitAPI: vi.fn(),
  uploadPromptFileAPI: vi.fn(),
  discardPromptFileAPI: vi.fn(),
}));
import * as api from "@/services/assessment.service";
import PromptFileField from "./prompt.file.field";

const MiB = 1024 * 1024;

beforeAll(() => {
  window.matchMedia =
    window.matchMedia ||
    ((query: string) => ({ matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }) as unknown as MediaQueryList);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const pick = (name: string, size: number) => {
  const file = new File(["%PDF-1.7 x"], name);
  Object.defineProperty(file, "size", { value: size });
  fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [file] } });
};

describe("PromptFileField", () => {
  it("shows the limit of the API and refuses a file one byte over it, in Vietnamese, without uploading", async () => {
    vi.mocked(api.getPromptFileLimitAPI).mockResolvedValue({ statusCode: 200, data: { maxFileBytes: 10 * MiB } } as never);
    render(<PromptFileField value={null} onChange={vi.fn()} />);
    await screen.findByText(/tối đa 10.0 MB/);
    pick("big.pdf", 10 * MiB + 1);
    await screen.findByText("Tệp quá lớn. Dung lượng tối đa là 10.0 MB.");
    expect(api.uploadPromptFileAPI).not.toHaveBeenCalled();
  });

  it("uploads a file of exactly the limit", async () => {
    vi.mocked(api.getPromptFileLimitAPI).mockResolvedValue({ statusCode: 200, data: { maxFileBytes: 10 * MiB } } as never);
    vi.mocked(api.uploadPromptFileAPI).mockResolvedValue({
      statusCode: 201,
      data: { fileKey: "k", fileName: "edge.pdf", mimeType: "application/pdf", sizeBytes: 10 * MiB },
    } as never);
    const onChange = vi.fn();
    render(<PromptFileField value={null} onChange={onChange} />);
    await screen.findByText(/tối đa 10.0 MB/);
    pick("edge.pdf", 10 * MiB);
    await waitFor(() => expect(api.uploadPromptFileAPI).toHaveBeenCalledTimes(1));
  });

  it("refuses another type with a Vietnamese message", async () => {
    vi.mocked(api.getPromptFileLimitAPI).mockResolvedValue({ statusCode: 200, data: { maxFileBytes: 10 * MiB } } as never);
    render(<PromptFileField value={null} onChange={vi.fn()} />);
    await screen.findByText(/tối đa 10.0 MB/);
    pick("virus.exe", 1000);
    await screen.findByText("Chỉ nhận tệp PDF, DOCX hoặc ZIP.");
    expect(api.uploadPromptFileAPI).not.toHaveBeenCalled();
  });
});
