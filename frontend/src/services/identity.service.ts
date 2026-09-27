import type { ILogin, IRegister, IUser } from "@/types/identity.types";
import axios from "@/services/axios.customize";

export const fetchAccountAPI = () =>
  axios.get<IBackendRes<{ user: IUser }>>("/api/v1/auth/account", {
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
