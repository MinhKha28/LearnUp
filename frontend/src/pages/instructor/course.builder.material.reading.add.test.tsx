// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import type {
  ICreateReadingMaterialResponse,
  IReadingUploadContext,
} from "@/types/course.types";
import CourseBuilderReadingAdd from "./course.builder.material.reading.add";

const { courseAxios, error, success, warning } = vi.hoisted(() => ({
  courseAxios: { get: vi.fn(), post: vi.fn() },
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
}));

vi.mock("@/services/axios.customize", () => ({ courseAxios }));
vi.mock("antd", async (importOriginal) => {
  const antd = await importOriginal<typeof import("antd")>();
  return {
    ...antd,
    message: { ...antd.message, error, success, warning },
  };
});

const materialsPath = "/instructor/courses/c1/builder/lessons/l1/materials";

const context: IReadingUploadContext = {
  courseName: "Fixture course",
  lessonTitle: "Fixture lesson",
  locked: false,
  subscriptionStatus: "Active",
  canUpload: true,
  blockReason: null,
  maxReadingSizeBytes: String(50 * 1024 * 1024),
  allowedReadingMimeTypes: ["application/pdf"],
  remainingStorageBytes: String(1024 * 1024 * 1024),
  readingSpeedWordsPerMinute: 200,
};

const ok = <T,>(data: T): IBackendRes<T> => ({ statusCode: 200, message: "OK", data });

async function uploadReading() {
  courseAxios.get.mockResolvedValue(ok(context));
  const { container } = render(
    <MemoryRouter initialEntries={[`${materialsPath}/readings/new`]}>
      <Routes>
        <Route
          path="/instructor/courses/:courseId/builder/lessons/:lessonId/materials/readings/new"
          element={<CourseBuilderReadingAdd />}
        />
        <Route path={materialsPath} element={<p>Material list</p>} />
      </Routes>
    </MemoryRouter>,
  );

  await screen.findByText("Thêm tài liệu đọc");
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  fireEvent.change(input!, {
    target: {
      files: [new File(["%PDF-1.7"], "reading.pdf", { type: "application/pdf" })],
    },
  });
  fireEvent.click(screen.getByRole("button", { name: "Tải tài liệu đọc lên" }));
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it.each([
  {
    name: "503 READING_PARSE_BUSY with retryAfterSeconds",
    body: {
      statusCode: 503,
      error: {
        statusCode: 503,
        code: "READING_PARSE_BUSY",
        message: "Reading processing is busy. Retry later.",
        retryAfterSeconds: 10,
      },
    },
    expected: "Hệ thống đang bận xử lý tài liệu đọc. Vui lòng thử lại sau 10 giây.",
  },
  {
    name: "503 READING_PARSE_BUSY without retryAfterSeconds",
    body: { statusCode: 503, error: { code: "READING_PARSE_BUSY" } },
    expected: "Hệ thống đang bận xử lý tài liệu đọc. Vui lòng thử lại sau ít phút.",
  },
  {
    name: "403",
    body: { statusCode: 403, error: "Subscription does not allow Reading uploads." },
    expected: "Gói dịch vụ hoặc quyền giảng viên không cho phép tải tệp lên.",
  },
  {
    name: "409",
    body: { statusCode: 409, error: "Insufficient Subscription storage." },
    expected: "Trạng thái khóa học hoặc dung lượng lưu trữ đã thay đổi.",
  },
  {
    name: "413",
    body: { statusCode: 413, error: { statusCode: 413, message: "Reading exceeds the allowed size." } },
    expected: "Tài liệu đọc vượt quá dung lượng cho phép.",
  },
  {
    name: "400 with the backend message",
    body: {
      statusCode: 400,
      error: {
        statusCode: 400,
        message: "Unable to read PDF. The file may be corrupted or password-protected.",
      },
    },
    expected: "Unable to read PDF. The file may be corrupted or password-protected.",
  },
])("shows the mapped message for a resolved $name error body", async ({ body, expected }) => {
  courseAxios.post.mockResolvedValueOnce(body);
  await uploadReading();

  await waitFor(() => expect(error).toHaveBeenCalledWith(expected));
  expect(success).not.toHaveBeenCalled();
  expect(screen.queryByText("Material list")).toBeNull();
});

it("shows the busy message when Axios rejects with the 503 body", async () => {
  courseAxios.post.mockRejectedValueOnce({
    isAxiosError: true,
    response: {
      status: 503,
      data: {
        statusCode: 503,
        error: { code: "READING_PARSE_BUSY", retryAfterSeconds: 10 },
      },
    },
  });
  await uploadReading();

  await waitFor(() =>
    expect(error).toHaveBeenCalledWith(
      "Hệ thống đang bận xử lý tài liệu đọc. Vui lòng thử lại sau 10 giây.",
    ),
  );
});

it.each([
  { name: "a network error", failure: { isAxiosError: true, code: "ERR_NETWORK", message: "Network Error" } },
  { name: "a timeout", failure: { isAxiosError: true, code: "ECONNABORTED", message: "timeout of 120000ms exceeded" } },
  { name: "an aborted request", failure: { isAxiosError: true, code: "ERR_CANCELED", message: "canceled" } },
])("shows the connection message when there is no HTTP response ($name)", async ({ failure }) => {
  courseAxios.post.mockRejectedValueOnce(failure);
  await uploadReading();

  await waitFor(() =>
    expect(error).toHaveBeenCalledWith(
      "Không gửi được tệp. Vui lòng kiểm tra kết nối rồi thử lại.",
    ),
  );
  expect(error).not.toHaveBeenCalledWith("Network Error");
});

it("describes the upload box and the selected file in Vietnamese", async () => {
  courseAxios.post.mockReturnValueOnce(new Promise(() => undefined));
  await uploadReading();

  expect(screen.getByText("Định dạng cho phép: PDF")).toBeTruthy();
  expect(screen.getByText("Giới hạn dung lượng truyền tải: 50.0 MB")).toBeTruthy();
  expect(screen.getByText(/^Tệp đã chọn: reading\.pdf \(/)).toBeTruthy();
  expect(screen.queryByText(/Supported:|Selected:/)).toBeNull();
});

it("still saves and returns to the list on success", async () => {
  const created: ICreateReadingMaterialResponse = {
    id: "m1",
    wordCount: 9,
    extractionWarning: null,
  } as ICreateReadingMaterialResponse;
  courseAxios.post.mockResolvedValueOnce(ok(created));
  await uploadReading();

  await screen.findByText("Material list");
  expect(success).toHaveBeenCalledWith("Đã lưu tài liệu đọc: 9 từ.");
  expect(error).not.toHaveBeenCalled();
});
