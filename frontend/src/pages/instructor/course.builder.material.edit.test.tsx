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
  return screen.findByLabelText("Material title");
}

const save = () => fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

async function replaceFile(file: File) {
  fireEvent.change(screen.getByLabelText("Choose replacement file"), {
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

  fireEvent.change(title, { target: { value: " Revised reading " } });
  fireEvent.click(screen.getByRole("radio", { name: "Optional" }));
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

  await waitFor(() => expect(error).toHaveBeenCalledWith("Material changed."));
  expect(success).not.toHaveBeenCalled();
  expect(screen.queryByText("Material list")).toBeNull();
});

it("reports a 413 replacement response and skips the metadata patch", async () => {
  courseAxios.post.mockResolvedValueOnce({
    statusCode: 413,
    code: "FILE_TOO_LARGE",
    message: "Replacement exceeds the allowed size.",
  });
  const title = await openEditor();
  fireEvent.change(title, { target: { value: "Revised reading" } });
  await replaceFile(new File(["%PDF-1.7"], "replacement.pdf", { type: "application/pdf" }));

  expect(error).toHaveBeenCalledWith(expect.stringContaining("File replacement was not confirmed"), 8);
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
