// @vitest-environment jsdom
// The Learner dashboard and the review history still use sample data, but their text is Vietnamese like the rest of the UI.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import Dashboard from "./dashboard";
import PeerReviewHistory from "./peer.review.history";

const Where = () => <p data-testid="where">{useLocation().pathname}</p>;
const renderAt = (path: string, element: JSX.Element) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={path} element={element} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

beforeAll(() => {
  window.matchMedia =
    window.matchMedia ||
    ((query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList);
});
afterEach(cleanup);

describe("Learner dashboard", () => {
  it("is in Vietnamese and sends the Learner to the review tasks", async () => {
    renderAt("/learner", <Dashboard />);
    expect(screen.getByText("Việc học của bạn trong một cái nhìn")).toBeTruthy();
    expect(screen.getByText("Đào tạo bắt buộc")).toBeTruthy();
    expect(screen.getByText("Nhiệm vụ chấm chéo")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Required training|Up next|Peer review tasks|View tasks/);
    fireEvent.click(screen.getByRole("button", { name: "Xem nhiệm vụ" }));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/learner/peer-review"));
  });
});

describe("Learner review history", () => {
  it("is in Vietnamese: the obligation, the table and the condition", () => {
    renderAt("/learner/peer-review/history", <PeerReviewHistory />);
    expect(screen.getByText("Lịch sử chấm của tôi")).toBeTruthy();
    expect(screen.getByText("Nghĩa vụ chấm chéo")).toBeTruthy();
    expect(screen.getByText("Các bài đã chấm")).toBeTruthy();
    expect(screen.getByText("Điều kiện đánh giá")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Review obligation|Completed reviews|Score given|Assessment condition/);
  });
});
