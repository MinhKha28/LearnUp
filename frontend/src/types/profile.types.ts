export type ProfileRole = "Admin" | "Organizer" | "Instructor" | "Learner";
export type ProfileStatus = "Pending" | "Active" | "Deactivated";

export interface IMyProfile {
  id: string;
  fullName: string;
  email: string;
  role: ProfileRole;
  status: ProfileStatus;
  department: string | null;
  organizationId: string | null;
  organizationName: string | null;
  avatarUrl: string | null;
  activatedAt: string | null;
}
