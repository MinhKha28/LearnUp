import { tenantAxios } from "@/services/axios.customize";
import type { IMyProfile } from "@/types/profile.types";
import type { IUser } from "@/types/identity.types";

export const getMyProfileAPI = () =>
  tenantAxios.get<IBackendRes<IMyProfile>>("/api/v1/users/me");

export const updateMyProfileAPI = (fullName: string) =>
  tenantAxios.patch<IBackendRes<IMyProfile>>("/api/v1/users/me", {
    fullName,
  });

export const uploadAvatarAPI = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return tenantAxios.put<IBackendRes<IMyProfile>>(
    "/api/v1/users/me/avatar",
    form,
  );
};

export const removeAvatarAPI = () =>
  tenantAxios.delete<IBackendRes<IMyProfile>>("/api/v1/users/me/avatar");

export const withProfile = (user: IUser, profile?: IMyProfile | null): IUser =>
  profile
    ? {
        ...user,
        fullName: profile.fullName,
        avatar: profile.avatarUrl ?? undefined,
      }
    : user;

export const loadUserWithProfile = async (user: IUser): Promise<IUser> => {
  try {
    const res = await getMyProfileAPI();
    return withProfile(user, res.data);
  } catch {
    return user;
  }
};
