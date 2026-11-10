// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/types/api.types";
vi.mock("@/services/achievement.service", () => ({
  downloadCertificate: vi.fn(),
}));
import { downloadCertificate } from "@/services/achievement.service";
import { useCertificateDownload } from "./use.certificate.download";
function Harness() {
  const state = useCertificateDownload();
  return (
    <>
      <button
        disabled={state.busy.has("one")}
        onClick={() => void state.download("one")}
      >
        Tải PDF
      </button>
      <p role="status">{state.messages.one}</p>
    </>
  );
}
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.useRealTimers();
});
describe("certificate download completion state", () => {
  it("enables manual retry in the same render as the exhausted-503 message", async () => {
    let refuse!: (error: unknown) => void;
    vi.mocked(downloadCertificate).mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          refuse = reject;
        }),
    );
    render(<Harness />);
    const button = screen.getByRole("button", {
      name: "Tải PDF",
    }) as HTMLButtonElement;
    fireEvent.click(button);
    fireEvent.click(button);
    expect(downloadCertificate).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(true);
    await act(async () => refuse(new ApiError(503, "SERVICE_UNAVAILABLE", "")));
    expect(screen.getByRole("status").textContent).toBe(
      "Hệ thống đang bận. Vui lòng thử tải lại sau.",
    );
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    expect(downloadCertificate).toHaveBeenCalledTimes(2);
    expect(button.disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toBe("");
    await act(async () => refuse(new ApiError(503, "SERVICE_UNAVAILABLE", "")));
    expect(button.disabled).toBe(false);
  });
});
