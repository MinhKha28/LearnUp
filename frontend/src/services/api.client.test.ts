import axios, { AxiosError, CanceledError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { describe, expect, it } from "vitest";

import { API_PATHS, toApiError } from "@/services/api.client";
import { ApiError, isRetryableError } from "@/types/api.types";

const config = { headers: {} } as InternalAxiosRequestConfig;

const httpError = (status: number, data: unknown) =>
  new AxiosError(`Request failed with status code ${status}`, "ERR_BAD_RESPONSE", config, {}, {
    status,
    statusText: "",
    headers: {},
    config,
    data,
  } as AxiosResponse);

describe("toApiError", () => {
  it("lỗi nghiệp vụ: lấy code, message và các trường còn lại làm details", () => {
    const error = toApiError(
      httpError(409, {
        statusCode: 409,
        path: "/api/v1/enrollments",
        error: { code: "ALREADY_ENROLLED", message: "Already enrolled", enrollmentId: "e1" },
      }),
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: "ALREADY_ENROLLED",
      message: "Already enrolled",
      details: { enrollmentId: "e1" },
    });
  });

  it("400 mặc định của Nest: message là mảng", () => {
    const error = toApiError(
      httpError(400, { statusCode: 400, message: ["courseId must be a UUID", "x should not exist"], error: "Bad Request" }),
    );
    expect(error).toMatchObject({
      status: 400,
      code: "VALIDATION_FAILED",
      message: "courseId must be a UUID; x should not exist",
      details: {},
    });
  });

  it("400 mặc định của Nest đã bị HttpExceptionFilter bọc trong error", () => {
    const error = toApiError(
      httpError(400, {
        statusCode: 400,
        error: { message: ["courseId must be a UUID"], error: "Bad Request", statusCode: 400 },
      }),
    );
    expect(error).toMatchObject({ status: 400, code: "VALIDATION_FAILED", message: "courseId must be a UUID" });
  });

  it("401 của guard dạng mặc định Nest", () => {
    const error = toApiError(
      httpError(401, {
        statusCode: 401,
        error: { message: "Invalid or missing internal service key.", error: "Unauthorized", statusCode: 401 },
      }),
    );
    expect(error).toMatchObject({
      status: 401,
      code: "HTTP_401",
      message: "Invalid or missing internal service key.",
    });
  });

  it("5xx không có body", () => {
    const error = toApiError(httpError(502, ""));
    expect(error).toMatchObject({ status: 502, code: "HTTP_502", message: "Request failed with status code 502" });
    expect(isRetryableError(error)).toBe(true);
  });

  it("timeout", () => {
    expect(toApiError(new AxiosError("timeout of 10000ms exceeded", "ECONNABORTED", config, {}))).toMatchObject({
      status: 0,
      code: "TIMEOUT",
    });
    expect(toApiError(new AxiosError("timeout", "ETIMEDOUT", config, {}))).toMatchObject({
      status: 0,
      code: "TIMEOUT",
    });
  });

  it("lỗi mạng", () => {
    expect(toApiError(new AxiosError("Network Error", "ERR_NETWORK", config, {}))).toMatchObject({
      status: 0,
      code: "NETWORK",
    });
    expect(toApiError(new Error("boom"))).toMatchObject({ status: 0, code: "NETWORK" });
  });

  it("request bị hủy: ném lại nguyên lỗi hủy", () => {
    const canceled = new CanceledError(undefined, undefined, config);
    expect(() => toApiError(canceled)).toThrow(canceled);
    expect(axios.isCancel(canceled)).toBe(true);
  });

  it("giữ nguyên ApiError có sẵn", () => {
    const error = new ApiError(404, "NOT_FOUND", "x");
    expect(toApiError(error)).toBe(error);
  });
});

describe("isRetryableError", () => {
  it("chỉ lỗi mạng, timeout và 502–504", () => {
    for (const status of [0, 502, 503, 504]) {
      expect(isRetryableError(new ApiError(status, "X", ""))).toBe(true);
    }
    for (const status of [400, 401, 403, 404, 409, 500]) {
      expect(isRetryableError(new ApiError(status, "X", ""))).toBe(false);
    }
  });
});

describe("API_PATHS", () => {
  it("mã hóa tham số đường dẫn", () => {
    expect(API_PATHS.courseIntroduction("../x")).toBe("/api/v1/courses/..%2Fx/introduction");
    expect(API_PATHS.lesson("e 1", "l/1")).toBe("/api/v1/enrollments/e%201/lessons/l%2F1");
  });
});
