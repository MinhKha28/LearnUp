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

    // DEV ONLY: with no gateway in front, impersonate the trusted headers it would inject.
    // Values come from an untracked .env.development.local and are never set in production.
    if (import.meta.env.DEV && import.meta.env.VITE_DEV_INTERNAL_KEY) {
      config.headers["x-internal-key"] = import.meta.env.VITE_DEV_INTERNAL_KEY;
      config.headers["x-user-id"] = import.meta.env.VITE_DEV_USER_ID;
      config.headers["x-organization-id"] = import.meta.env.VITE_DEV_ORGANIZATION_ID;
      config.headers["x-user-role"] = import.meta.env.VITE_DEV_USER_ROLE;
    }
    return config;
  },
  function (error) {
    // Do something with the request error
    return Promise.reject(error);
  }
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
  }
);

export default instance;
