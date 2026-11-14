// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { submitCourseForApprovalAPI } from "@/services/course.service";
import type {
  IInstructorLessonDetail,
  ISubmitCourseResponse,
  ITechnicalReplacementResponse,
  IUpdateMaterialResponse,
} from "@/types/course.types";
import CourseBuilderMaterialEdit from "./course.builder.material.edit";

const { courseAxios, confirm, error, success } = vi.hoisted(() => ({
  courseAxios: { get: vi.fn(), patch: vi.fn(), post: vi.fn() },
  confirm: vi.fn<(options: { onOk: () => Promise<void> }) => void>(),
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock("@/services/axios.customize", () => ({ courseAxios }));
vi.mock("antd", async (importOriginal) => {
  const antd = await importOriginal<typeof import("antd")>();
  return { ...antd, message: { ...antd.message, error, success }, Modal: { confirm } };
});

const materialsPath = "/instructor/courses/c1/builder/lessons/l1/materials";
const materialApiPath = "/api/v1/courses/c1/lessons/l1/materials/m1";

const detail: IInstructorLessonDetail = {
  course: { id: "c1", name: "Fixture course", status: "Draft", locked: false },
  module: { id: "module-1", title: "Module", position: 1 },
  lesson: {
    id: "l1",
    title: "Fixture lesson",
    content: "",
    position: 1,
    disabledAt: null,
    required: true,
  },
  materials: [
    {
      id: "m1",
      fileId: "file-1",
      title: "Current reading",
      materialType: "Reading",
      isRequired: true,
      position: 1,
      disabledAt: null,
      file: {
        originalFilename: "current.pdf",
        mimeType: "application/pdf",
        sizeBytes: "512",
        durationSeconds: null,
        wordCount: 35,
        status: "Ready",
        releasedAt: null,
      },
    },
  ],
};

const response = <T,>(data: T): IBackendRes<T> => ({
  statusCode: 200,
  message: "OK",
  data,
});

async function openEditor() {
  courseAxios.get.mockResolvedValueOnce(response(detail));
  render(
    <MemoryRouter initialEntries={[`${materialsPath}/m1/edit`]}>
      <Routes>
        <Route
          path="/instructor/courses/:courseId/builder/lessons/:lessonId/materials/:materialId/edit"
          element={<CourseBuilderMaterialEdit />}
        />
        <Route path={materialsPath} element={<p>Material list</p>} />
      </Routes>
    </MemoryRouter>,
  );
  return screen.findByLabelText("Tên học liệu");
}

const save = () => fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

async function replaceFile(file: File) {
  fireEvent.change(screen.getByLabelText("Chọn tệp thay thế"), {
    target: { files: [file] },
  });
  save();
  expect(confirm).toHaveBeenCalledOnce();
  expect(courseAxios.post).not.toHaveBeenCalled();
  await act(async () => {
    await confirm.mock.calls[0][0].onOk();
  });
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it("loads the lesson material and patches its title and required flag", async () => {
  const updated: IUpdateMaterialResponse = {
    id: "m1",
    title: "Revised reading",
    isRequired: false,
  };
  courseAxios.patch.mockResolvedValueOnce(response(updated));
  const title = await openEditor();
  expect(courseAxios.get).toHaveBeenCalledWith("/api/v1/courses/c1/lessons/l1", {
    signal: undefined,
  });
  expect((title as HTMLInputElement).value).toBe("Current reading");
  expect(screen.getAllByText("current.pdf")).toHaveLength(2);
  expect(screen.getByText("Sẵn sàng")).toBeTruthy();
  expect(screen.getByText("Không")).toBeTruthy();
  expect(screen.getByText("Tài liệu đọc", { selector: "strong" })).toBeTruthy();

  fireEvent.change(title, { target: { value: " Revised reading " } });
  fireEvent.click(screen.getByRole("radio", { name: "Không bắt buộc" }));
  save();

  await screen.findByText("Material list");
  expect(courseAxios.patch).toHaveBeenCalledWith(materialApiPath, {
    title: "Revised reading",
    isRequired: false,
  });
  expect(courseAxios.post).not.toHaveBeenCalled();
  expect(success).toHaveBeenCalledOnce();
});

it("posts the replacement as multipart data after confirmation", async () => {
  const replaced: ITechnicalReplacementResponse = {
    materialId: "m1",
    fileId: "file-1",
    storageKey: "test/replacement.pdf",
    sizeBytes: "8",
    durationSeconds: null,
    wordCount: 35,
    extractionWarning: null,
  };
  courseAxios.post.mockResolvedValueOnce(response(replaced));
  await openEditor();
  const file = new File(["%PDF-1.7"], "replacement.pdf", { type: "application/pdf" });
  await replaceFile(file);

  await screen.findByText("Material list");
  expect(courseAxios.post).toHaveBeenCalledWith(
    `${materialApiPath}/technical-replacement`,
    expect.any(FormData),
    expect.objectContaining({ onUploadProgress: expect.any(Function) }),
  );
  expect(courseAxios.post.mock.calls[0][1].get("file")).toEqual(file);
  expect(courseAxios.patch).not.toHaveBeenCalled();
  expect(success).toHaveBeenCalledOnce();
});

it("reports a rejected metadata response and stays on the editor", async () => {
  courseAxios.patch.mockResolvedValueOnce({ statusCode: 409, message: "Material changed." });
  const title = await openEditor();
  fireEvent.change(title, { target: { value: "Revised reading" } });
  save();

  await waitFor(() => expect(error).toHaveBeenCalledWith("Không thể lưu học liệu."));
  expect(success).not.toHaveBeenCalled();
  expect(screen.queryByText("Material list")).toBeNull();
});

it.each([
  {
    response: { statusCode: 413, error: { code: "FILE_TOO_LARGE" } },
    expected: "Tệp vượt quá kích thước cho phép. Vui lòng chọn tệp nhỏ hơn.",
  },
  {
    response: {
      statusCode: 413,
      error: { code: "FILE_TOO_LARGE", maxSizeBytes: 12.5 * 1024 * 1024 },
    },
    expected: "Tệp vượt quá kích thước cho phép (12,5 MB). Vui lòng chọn tệp nhỏ hơn.",
  },
  {
    response: { code: "FILE_TOO_LARGE" },
    expected: "Tệp vượt quá kích thước cho phép. Vui lòng chọn tệp nhỏ hơn.",
  },
])("reports the size error for $response", async ({ response, expected }) => {
  courseAxios.post.mockResolvedValueOnce(response);
  const title = await openEditor();
  fireEvent.change(title, { target: { value: "Revised reading" } });
  await replaceFile(new File(["%PDF-1.7"], "replacement.pdf", { type: "application/pdf" }));

  expect(error).toHaveBeenCalledWith(expected, 8);
  expect(courseAxios.patch).not.toHaveBeenCalled();
  expect(success).not.toHaveBeenCalled();
  expect(screen.queryByText("Material list")).toBeNull();
});

it("reports the size error when Axios rejects with HTTP 413 and no body", async () => {
  courseAxios.post.mockRejectedValueOnce({
    isAxiosError: true,
    response: { status: 413 },
  });
  await openEditor();
  await replaceFile(new File(["%PDF-1.7"], "replacement.pdf", { type: "application/pdf" }));

  expect(error).toHaveBeenCalledWith(
    "Tệp vượt quá kích thước cho phép. Vui lòng chọn tệp nhỏ hơn.",
    8,
  );
  expect(success).not.toHaveBeenCalled();
  expect(screen.queryByText("Material list")).toBeNull();
});

it.each([
  {
    name: "a resolved 503 body with retryAfterSeconds",
    arrange: () =>
      courseAxios.post.mockResolvedValueOnce({
        statusCode: 503,
        error: { statusCode: 503, code: "READING_PARSE_BUSY", retryAfterSeconds: 10 },
      }),
    expected: "Hệ thống đang bận xử lý tài liệu đọc. Vui lòng thử lại sau 10 giây.",
  },
  {
    name: "a rejected Axios 503 without retryAfterSeconds",
    arrange: () =>
      courseAxios.post.mockRejectedValueOnce({
        isAxiosError: true,
        response: { status: 503, data: { statusCode: 503, error: { code: "READING_PARSE_BUSY" } } },
      }),
    expected: "Hệ thống đang bận xử lý tài liệu đọc. Vui lòng thử lại sau ít phút.",
  },
])("reports the busy message for $name", async ({ arrange, expected }) => {
  arrange();
  const title = await openEditor();
  fireEvent.change(title, { target: { value: "Revised reading" } });
  await replaceFile(new File(["%PDF-1.7"], "replacement.pdf", { type: "application/pdf" }));

  expect(error).toHaveBeenCalledWith(expected, 8);
  expect(courseAxios.patch).not.toHaveBeenCalled();
  expect(success).not.toHaveBeenCalled();
  expect(screen.queryByText("Material list")).toBeNull();
});

it("keeps the generic message for another replacement HTTP error", async () => {
  courseAxios.post.mockResolvedValueOnce({
    statusCode: 503,
    error: { code: "UPLOAD_UNAVAILABLE", message: "Upload unavailable." },
  });
  const title = await openEditor();
  fireEvent.change(title, { target: { value: "Revised reading" } });
  await replaceFile(new File(["%PDF-1.7"], "replacement.pdf", { type: "application/pdf" }));

  expect(error).toHaveBeenCalledWith(
    "Chưa xác nhận được việc thay thế tệp. Tải lại trang và kiểm tra tệp hiện tại trước khi thử lại.",
    8,
  );
  expect(courseAxios.patch).not.toHaveBeenCalled();
  expect(success).not.toHaveBeenCalled();
  expect(screen.queryByText("Material list")).toBeNull();
});

it("keeps the separate course submission API", async () => {
  const submitted: ISubmitCourseResponse = {
    id: "c1",
    name: "Fixture course",
    versionNumber: 1,
    status: "Submitted",
    submittedAt: "2026-11-10T00:00:00.000Z",
  };
  courseAxios.post.mockResolvedValueOnce(response(submitted));
  await expect(submitCourseForApprovalAPI("c1")).resolves.toEqual(response(submitted));
  expect(courseAxios.post).toHaveBeenCalledWith("/api/v1/courses/c1/submit");
});
