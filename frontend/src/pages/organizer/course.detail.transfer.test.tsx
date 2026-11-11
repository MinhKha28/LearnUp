// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchTransferContextAPI,
  transferCourseOwnershipAPI,
} from "@/services/course.service";
import { getTransferCandidatesAPI } from "@/services/organization.service";
import CourseDetail from "./course.detail";

// The real Ant Design Select uses a portal and popup animations that are
// unreliable in JSDOM. Keep Form.Item and the page behavior real, while using
// a native select for deterministic UC23 API/error-flow assertions.
vi.mock("antd", async (importOriginal) => {
  const actual = await importOriginal<typeof import("antd")>();
  return {
    ...actual,
    Select: ({
      options = [],
      value,
      onChange,
      disabled,
      placeholder,
    }: {
      options?: Array<{ value: string; label: string }>;
      value?: string;
      onChange?: (value: string) => void;
      disabled?: boolean;
      placeholder?: string;
    }) => (
      <select
        aria-label="Instructor tiếp nhận"
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value)}
      >
        <option value="">{placeholder ?? "Select Instructor"}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    ),
  };
});

vi.mock("@/services/course.service", () => ({
  fetchTransferContextAPI: vi.fn(),
  transferCourseOwnershipAPI: vi.fn(),
}));
vi.mock("@/services/organization.service", () => ({
  getTransferCandidatesAPI: vi.fn(),
}));

const context = {
  courseId: "019a0000-0000-7000-8000-000000000003",
  chainId: "019a0000-0000-7000-8000-000000000004",
  courseName: "Safety Training",
  currentInstructor: {
    id: "019a0000-0000-7000-8000-000000000005",
    fullName: "Instructor A",
  },
  versions: [
    {
      id: "019a0000-0000-7000-8000-000000000003",
      name: "Safety Training",
      versionNumber: 2,
      status: "Published",
      createdAt: "2026-11-01T00:00:00.000Z",
      publishedAt: "2026-11-08T00:00:00.000Z",
    },
  ],
};
const receiver = { id: "019a0000-0000-7000-8000-000000000006", fullName: "Instructor B" };
const contextApi = vi.mocked(fetchTransferContextAPI);
const candidatesApi = vi.mocked(getTransferCandidatesAPI);
const transferApi = vi.mocked(transferCourseOwnershipAPI);

beforeAll(() => {
  window.matchMedia = window.matchMedia || ((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList);
});

beforeEach(() => {
  vi.clearAllMocks();
  contextApi.mockResolvedValue({ statusCode: 200, data: context } as never);
  candidatesApi.mockResolvedValue({ statusCode: 200, data: [receiver] } as never);
});
afterEach(cleanup);

function openPage() {
  render(
    <MemoryRouter initialEntries={["/organizer/courses/" + context.courseId]}>
      <Routes>
        <Route path="/organizer/courses/:courseId" element={<CourseDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("UC23 Course Detail transfer", () => {
  it("renders the real Course context instead of placeholder versions", async () => {
    openPage();
    expect(await screen.findByText("Instructor A")).toBeTruthy();
    expect(screen.getByText("Safety Training")).toBeTruthy();
    expect(screen.getByText("v2")).toBeTruthy();
    expect(screen.queryByText("An Tran")).toBeNull();
    expect(contextApi).toHaveBeenCalledWith(context.courseId);
  });

  it("does not open the transfer form when candidate API fails", async () => {
    candidatesApi.mockResolvedValue({ statusCode: 503, error: { code: "TENANT_UNAVAILABLE" } } as never);
    openPage();
    fireEvent.click(await screen.findByRole("button", { name: "Chuyển quyền phụ trách" }));
    await waitFor(() => expect(candidatesApi).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Instructor tiếp nhận")).toBeNull();
    expect(transferApi).not.toHaveBeenCalled();
  });

  it("keeps the modal open on a resolved 409 API envelope", async () => {
    transferApi.mockResolvedValue({ statusCode: 409, error: { code: "COURSE_CHANGED" } } as never);
    openPage();
    fireEvent.click(await screen.findByRole("button", { name: "Chuyển quyền phụ trách" }));
    const selector = await screen.findByRole("combobox", { name: "Instructor tiếp nhận" });
    fireEvent.change(selector, { target: { value: receiver.id } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận chuyển quyền" }));
    await waitFor(() => expect(transferApi).toHaveBeenCalledTimes(1));
    expect((await screen.findAllByText(/Quyền phụ trách đã thay đổi/)).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Xác nhận chuyển quyền" })).toBeTruthy();
  });
});
