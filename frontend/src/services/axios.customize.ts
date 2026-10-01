import axios from "axios";
const instance = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL,
  withCredentials: true,
});

// Add a request interceptor
instance.interceptors.request.use(
  function (config) {
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
  },
  function (error) {
    // Do something with the request error
    return Promise.reject(error);
  },
);

// Add a response interceptor
instance.interceptors.response.use(
  function (response) {
    // Any status code that lies within the range of 2xx causes this function to trigger
    // Do something with response data
    if (response && response.data && response.data.data) {
      return response.data;
    }
    return response;
  },
  function (error) {
    // Any status codes that fall outside the range of 2xx cause this function to trigger
    // Do something with response error
    if (error && error.response && error.response.data) {
      return error.response.data;
    }
    return Promise.reject(error);
  },
);

export default instance;
