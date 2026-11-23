// @vitest-environment jsdom-native
import { message } from "antd";
import axios from "axios";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import EvaluationExport from "./evaluation.export";

const explanationTitle = "Chưa hỗ trợ xuất kết quả đánh giá";
const explanationText = "Tính năng xuất kết quả đánh giá đang được phát triển. Hiện hệ thống chưa tạo được tệp Excel hoặc PDF.";
const exportPath = "/instructor/evaluations/export";

const CurrentLocation = () => {
  const location = useLocation();
  return <output data-testid="current-location">{location.pathname}</output>;
};

const renderExport = () => render(
  <MemoryRouter initialEntries={[exportPath]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <EvaluationExport />
    <CurrentLocation />
  </MemoryRouter>,
);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Instructor evaluation export unavailable state", () => {
  it("shows a persistent Vietnamese explanation", () => {
    renderExport();

    expect(screen.getByText(explanationTitle)).toBeTruthy();
    expect(screen.getByText(explanationText)).toBeTruthy();
  });

  it.each(["Xuất kết quả đánh giá", "Excel", "PDF"])("disables %s and links it to the explanation", (name) => {
    renderExport();

    const button = screen.getByRole<HTMLButtonElement>("button", { name });
    expect(button.disabled).toBe(true);
    const descriptionId = button.getAttribute("aria-describedby");
    expect(descriptionId).toBeTruthy();
    const explanation = document.getElementById(descriptionId ?? "");
    expect(explanation?.textContent).toContain(explanationTitle);
    expect(explanation?.textContent).toContain(explanationText);
  });

  it("keeps the screen and route unchanged without export side effects", () => {
    const success = vi.spyOn(message, "success");
    const fetchRequest = vi.fn();
    vi.stubGlobal("fetch", fetchRequest);
    const axiosRequest = vi.spyOn(axios.Axios.prototype, "request");
    const xhrRequest = vi.spyOn(XMLHttpRequest.prototype, "open");
    const download = vi.spyOn(HTMLAnchorElement.prototype, "click");
    const openWindow = vi.spyOn(window, "open");
    const { container } = renderExport();
    const beforeClick = container.innerHTML;

    fireEvent.click(screen.getByRole("button", { name: "Xuất kết quả đánh giá" }));

    expect(container.innerHTML).toBe(beforeClick);
    expect(screen.getByTestId("current-location").textContent).toBe(exportPath);
    expect(success).not.toHaveBeenCalled();
    expect(fetchRequest).not.toHaveBeenCalled();
    expect(axiosRequest).not.toHaveBeenCalled();
    expect(xhrRequest).not.toHaveBeenCalled();
    expect(download).not.toHaveBeenCalled();
    expect(openWindow).not.toHaveBeenCalled();
  });

  it("does not present the sample course, version, or export-promising subtitle", () => {
    renderExport();

    expect(screen.queryByText("Workplace Safety Essentials")).toBeNull();
    expect(screen.queryByText(/\bVersion\b|\bv1\b/)).toBeNull();
    expect(screen.queryByText("Phạm vi")).toBeNull();
    expect(screen.queryByText("Xuất điểm đánh giá và nhận xét ẩn danh của khóa học.")).toBeNull();
  });
});
