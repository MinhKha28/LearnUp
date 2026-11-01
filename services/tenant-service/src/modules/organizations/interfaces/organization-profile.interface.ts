/** UC11: thông tin Organization của Organizer đang đăng nhập (BR-52). */
export interface IOrganizationProfile {
  id: string;
  name: string;
  taxCode: string;
  address: string;
  contactPhone: string;
  contactEmail: string | null;
  logoUrl: string | null;
  timezone: string;
  status: string;
  updatedAt: Date;
}
