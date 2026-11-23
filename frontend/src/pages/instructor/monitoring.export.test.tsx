// @vitest-environment jsdom-native
import { message } from "antd";
import axios from "axios";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MonitoringExport from "./monitoring.export";

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...await importOriginal<typeof import("react-router-dom")>(),
  useNavigate: () => navigate,
}));

const explanationTitle = "Chưa hỗ trợ xuất báo cáo";
const explanationText = "Tính năng xuất báo cáo đang được phát triển. Hiện hệ thống chưa tạo được tệp Excel hoặc PDF.";

const showPage = () => render(
  <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <MonitoringExport />
  </MemoryRouter>,
);

beforeEach(() => {
  navigate.mockClear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Instructor report export unavailable state", () => {
  it("explains why export is unavailable and describes the disabled action", () => {
    showPage();

    expect(screen.getByText(explanationTitle)).toBeTruthy();
    expect(screen.getByText(explanationText)).toBeTruthy();
    const button = screen.getByRole<HTMLButtonElement>("button", { name: "Xuất báo cáo" });
    expect(button.disabled).toBe(true);
    const descriptionId = button.getAttribute("aria-describedby");
    expect(descriptionId).toBeTruthy();
    const description = document.getElementById(descriptionId ?? "");
    expect(description?.textContent).toContain(explanationTitle);
    expect(description?.textContent).toContain(explanationText);
  });

  it.each(["Excel", "PDF"])("keeps the planned %s format visible and disabled", (format) => {
    showPage();

    const button = screen.getByRole<HTMLButtonElement>("button", { name: format });
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(button.disabled).toBe(true);
  });

  it("does nothing when the export action is clicked", () => {
    const success = vi.spyOn(message, "success");
    const fetchRequest = vi.fn();
    vi.stubGlobal("fetch", fetchRequest);
    const axiosRequest = vi.spyOn(axios.Axios.prototype, "request");
    const xhrRequest = vi.spyOn(XMLHttpRequest.prototype, "open");
    const download = vi.spyOn(HTMLAnchorElement.prototype, "click");
    const openWindow = vi.spyOn(window, "open");
    const { container } = showPage();
    const beforeClick = container.innerHTML;

    fireEvent.click(screen.getByRole("button", { name: "Xuất báo cáo" }));

    expect(container.innerHTML).toBe(beforeClick);
    expect(success).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(fetchRequest).not.toHaveBeenCalled();
    expect(axiosRequest).not.toHaveBeenCalled();
    expect(xhrRequest).not.toHaveBeenCalled();
    expect(download).not.toHaveBeenCalled();
    expect(openWindow).not.toHaveBeenCalled();
  });
});
