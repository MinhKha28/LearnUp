import type {
  IChangePasswordReq,
  IForgotPasswordReq,
  ILogin,
  IPasswordRecoveryResponse,
  IPasswordRecoveryResult,
  IRegister,
  IResetPasswordReq,
  IUser,
} from "@/types/identity.types";
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

export const changePasswordAPI = (body: IChangePasswordReq) =>
  axios.post<IBackendRes<{ message: string }>>(
    "/api/v1/auth/change-password",
    body,
  );

const postRecoveryRequest = async (
  path: string,
  body: IForgotPasswordReq | IResetPasswordReq,
): Promise<IPasswordRecoveryResult> => {
  try {
    // Keep the shared client, but retain status and the raw envelope for these public
    // operations. Resolving every HTTP status also prevents session refresh/replay.
    const response = await axios.post<string, { status: number; data: string }>(path, body, {
      timeout: 10000,
      withCredentials: false,
      responseType: "text",
      validateStatus: () => true,
      transformResponse: [(value: unknown) => value],
      headers: { "Content-Type": "application/json" },
      transformRequest: [(payload: unknown, headers) => {
        // The shared request interceptor adds these; recovery needs neither identity
        // proof nor development impersonation. No global interceptor is changed.
        headers.delete("Authorization");
        headers.delete("x-dev-user-id");
        headers.delete("X-Internal-Key");
        headers.delete("X-User-ID");
        headers.delete("X-Organization-ID");
        headers.delete("X-User-Role");
        return JSON.stringify(payload);
      }],
    });
    const envelope: IPasswordRecoveryResponse | null = JSON.parse(response.data);
    if (response.status >= 200 && response.status < 300 && envelope?.success === true
      && typeof envelope.data?.message === "string" && envelope.data.message.trim()
      && envelope.error == null) {
      return { success: true };
    }
    if (path === "/api/v1/auth/reset-password" && response.status === 400
      && envelope?.success === false && envelope.error?.code === "BAD_REQUEST"
      && envelope.error.message === "Invalid, expired, or already used password reset token") {
      return { success: false, error: "invalid-token" };
    }
  } catch {
    // Never propagate Axios errors: their config/body may contain the reset token
    // and passwords. Pages display only fixed, privacy-preserving diagnostics.
  }
  return { success: false, error: "unavailable" };
};

export const forgotPasswordAPI = (body: IForgotPasswordReq) =>
  postRecoveryRequest("/api/v1/auth/forgot-password", body);

export const resetPasswordAPI = (body: IResetPasswordReq) =>
  postRecoveryRequest("/api/v1/auth/reset-password", body);

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
