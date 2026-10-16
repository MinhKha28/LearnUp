import type { UserRole } from "@/types/identity.types";

export const ACCESS_TOKEN_KEY = "access_token";
export const REFRESH_TOKEN_KEY = "refresh_token";

const HOME_BY_ROLE: Record<UserRole, string> = {
  ADMIN: "/admin",
  ORGANIZER: "/organizer",
  INSTRUCTOR: "/instructor",
  LEARNER: "/learner",
};

export const homePathForRole = (role?: string | null): string =>
  (role && HOME_BY_ROLE[role as UserRole]) || "/";

export const safeRedirect = (target: string | null): string | null =>
  target && target.startsWith("/") && !target.startsWith("//") ? target : null;

export const saveTokens = (accessToken: string, refreshToken: string) => {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
};

export const clearTokens = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
};
