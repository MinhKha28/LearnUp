export interface IProfile {
  id: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
  department: string | null;
  organizationId: string | null;
  organizationName: string | null;
  avatarUrl: string | null;
  activatedAt: Date | null;
}
