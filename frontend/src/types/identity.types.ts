export type UserRole = "ADMIN" | "ORGANIZER" | "INSTRUCTOR" | "LEARNER";

export interface IUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  organizationId?: string | null;
  avatar?: string;
}

export interface ILogin {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number; // giây
  user: IUser;
}

export interface IChangePasswordReq {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
}

export interface IForgotPasswordReq {
  email: string;
}

export interface IResetPasswordReq {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

// Identity's Java envelope differs from the legacy global IBackendRes contract.
export interface IPasswordRecoveryResponse {
  success: boolean;
  data?: { message: string };
  error?: { code: string; message: string };
}

export type IPasswordRecoveryResult =
  | { success: true }
  | { success: false; error: "invalid-token" | "unavailable" };

export interface IRegister {
  fullName: string;
  email: string;
  password: string;
  phone: string;
}
