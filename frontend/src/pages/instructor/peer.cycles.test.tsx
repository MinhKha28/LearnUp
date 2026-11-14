// @vitest-environment jsdom
// UC33 from the sidebar: the Course and the Assignment stay chosen when the Instructor comes back from the detail of a cycle.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/axios.customize", () => ({ assessmentAxios: {}, default: {} }));
vi.mock("@/services/course.service", () => ({ fetchManagedCoursesAPI: vi.fn() }));
vi.mock("@/services/assessment.service", () => ({ fetchAssignmentsAPI: vi.fn() }));
vi.mock("@/components/instructor/peer.cycle.table", () => ({
  default: ({ assignmentId }: { assignmentId: string }) => <div>Bảng của {assignmentId}</div>,
}));

import { fetchAssignmentsAPI } from "@/services/assessment.service";
import { fetchManagedCoursesAPI } from "@/services/course.service";
import PeerCycles from "./peer.cycles";

const courses = vi.mocked(fetchManagedCoursesAPI);
const assignments = vi.mocked(fetchAssignmentsAPI);
const ASSIGNMENTS: Record<string, { id: string; title: string; peerReviewEnabled: boolean }[]> = {
  c1: [{ id: "a1", title: "Bài một", peerReviewEnabled: true }],
  c2: [
    { id: "a2", title: "Bài hai", peerReviewEnabled: true },
    { id: "a3", title: "Bài ba", peerReviewEnabled: true },
    { id: "a4", title: "Không chấm chéo", peerReviewEnabled: false },
  ],
};

let nav: ReturnType<typeof useNavigate>;
let search = "";
const Probe = () => {
  nav = useNavigate();
  search = useLocation().search;
  return null;
};
const open = (url = "/instructor/peer-cycles") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/instructor/peer-cycles" element={<><PeerCycles /><Probe /></>} />
        <Route path="/instructor/peer-cycles/:assignmentId/:cycleId" element={<><div>Chi tiết chu kỳ</div><Probe /></>} />
      </Routes>
    </MemoryRouter>,
  );

beforeAll(() => {
  window.matchMedia ??= (() => ({
    matches: false,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as never;
});
beforeEach(() => {
  courses.mockReset();
  assignments.mockReset();
  courses.mockResolvedValue({
    data: { result: [{ id: "c1", name: "Khóa một" }, { id: "c2", name: "Khóa hai" }] },
  } as never);
  assignments.mockImplementation(
    ((id: string) => Promise.resolve({ data: { items: ASSIGNMENTS[id] ?? [] } })) as never,
  );
});
afterEach(cleanup);

describe("Peer review cycles: the choice survives a visit to a cycle", () => {
  it("starts at the first Course and Assignment, and writes them in the address", async () => {
    open();
    expect(await screen.findByText("Bảng của a1")).toBeTruthy();
    expect(search).toBe("?courseId=c1&assignmentId=a1");
  });

  it("an address with a Course and an Assignment keeps them", async () => {
    open("/instructor/peer-cycles?courseId=c2&assignmentId=a3");
    expect(await screen.findByText("Bảng của a3")).toBeTruthy();
    expect(screen.getByText("Khóa hai")).toBeTruthy();
    expect(search).toBe("?courseId=c2&assignmentId=a3");
  });

  it("going to the detail of a cycle and back shows the same Assignment, not the first one", async () => {
    open("/instructor/peer-cycles?courseId=c2&assignmentId=a3");
    await screen.findByText("Bảng của a3");
    act(() => nav("/instructor/peer-cycles/a3/cycle-1"));
    expect(await screen.findByText("Chi tiết chu kỳ")).toBeTruthy();
    act(() => nav(-1));
    expect(await screen.findByText("Bảng của a3")).toBeTruthy();
    expect(screen.getByText("Khóa hai")).toBeTruthy();
  });

  it("changing the Course moves to the first Assignment with Peer Review of that Course", async () => {
    open("/instructor/peer-cycles?courseId=c1&assignmentId=a1");
    await screen.findByText("Bảng của a1");
    const box = screen.getByText("Khóa một").closest(".ant-select")!;
    fireEvent.mouseDown(box.querySelector(".ant-select-selector")!);
    fireEvent.click(await screen.findByTitle("Khóa hai"));
    await waitFor(() => expect(search).toBe("?courseId=c2&assignmentId=a2"));
    expect(await screen.findByText("Bảng của a2")).toBeTruthy();
  });
});
