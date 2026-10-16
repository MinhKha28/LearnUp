import type { ILogin, IRegister, IUser } from "@/types/identity.types";
import axios from "@/services/axios.customize";

export const fetchAccountAPI = () =>
  axios.get<IBackendRes<IUser>>("/api/v1/auth/me", {
    timeout: 10000,
  });

export const loginAPI = (username: string, password: string) => {
  const urlBackend = "/api/v1/auth/login";
  return axios.post<IBackendRes<ILogin>>(
    urlBackend,
    { username, password },
    {
      headers: {
        delay: 1000,
      },
    },
  );
};

// UC06 - Đăng xuất: thu hồi refresh token của phiên hiện tại
export const logoutAPI = (refreshToken: string) =>
  axios.post<IBackendRes<{ message: string }>>("/api/v1/auth/logout", {
    refreshToken,
  });

export const registerAPI = (
  fullName: string,
  email: string,
  password: string,
  phone: string,
) => {
  const urlBackend = "/api/v1/user/register";
  return axios.post<IBackendRes<IRegister>>(urlBackend, {
    fullName,
    email,
    password,
    phone,
  });
};
