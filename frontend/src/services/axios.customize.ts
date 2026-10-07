import axios, { type AxiosError, type AxiosInstance, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";

import { env, type BackendService } from "@/config/env";

// Add a request interceptor
const onRequest = function (config: InternalAxiosRequestConfig) {
  // Do something before the request is sent
  const token = localStorage.getItem("access_token");
  const auth = token ? `Bearer ${token}` : "";
  config.headers["Authorization"] = auth;
  // TẠM THỜI (UC12): fake danh tính khi tenant-service chưa đi qua api-gateway được.
  // Chỉ gửi khi chạy dev VÀ có VITE_DEV_FAKE_USER_ID; backend cần DEV_FAKE_AUTH=true.
  // Gỡ bỏ khi gateway dùng được (xem tenant-service: src/common/middleware/dev-fake-auth.middleware.ts).
  const devFakeUserId = import.meta.env.VITE_DEV_FAKE_USER_ID;
  if (import.meta.env.DEV && devFakeUserId) {
    config.headers["x-dev-user-id"] = devFakeUserId;
  }
  return config;
};

const onRequestError = function (error: unknown) {
  // Do something with the request error
  return Promise.reject(error);
};

// Add a response interceptor
const onResponse = function (response: AxiosResponse) {
  // Any status code that lies within the range of 2xx causes this function to trigger
  // Do something with response data
  if (response && response.data && response.data.data) {
    return response.data;
  }
  return response;
};

const onResponseError = function (error: AxiosError) {
  // Any status codes that fall outside the range of 2xx cause this function to trigger
  // Do something with response error
  if (error && error.response && error.response.data) {
    return error.response.data;
  }
  return Promise.reject(error);
};

/** Mỗi instance một base URL, cùng dùng các interceptor ở trên. */
const createBackendInstance = (baseURL: string): AxiosInstance => {
  const instance = axios.create({
    baseURL,
    withCredentials: true,
  });
  instance.interceptors.request.use(onRequest, onRequestError);
  instance.interceptors.response.use(onResponse, onResponseError);
  return instance;
};

const createServiceInstance = (service: BackendService) => createBackendInstance(env.backendUrl[service]);

export const tenantAxios = createServiceInstance("tenant");
export const courseAxios = createServiceInstance("course");
export const assessmentAxios = createServiceInstance("assessment");

// Service chưa có biến riêng (identity) vẫn dùng VITE_BACKEND_URL như trước.
const instance = createBackendInstance(import.meta.env.VITE_BACKEND_URL);

export default instance;
