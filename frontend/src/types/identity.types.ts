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

export interface IRegister {
  fullName: string;
  email: string;
  password: string;
  phone: string;
}
