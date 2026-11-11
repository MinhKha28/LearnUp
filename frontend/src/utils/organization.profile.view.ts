import type {
  IOrganizationProfile,
  IUpdateOrganizationReq,
} from "@/types/organization.types";
import { normalizeEmail, normalizeText } from "@/utils/helper";

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_ACCEPT = "image/png,image/jpeg";

const LEGACY_ZONE_NAMES: Record<string, string> = {
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Rangoon": "Asia/Yangon",
  "Europe/Kiev": "Europe/Kyiv",
  "Atlantic/Faeroe": "Atlantic/Faroe",
  "America/Godthab": "America/Nuuk",
};

export interface OrganizationFormValues {
  name: string;
  taxCode: string;
  address: string;
  contactPhone: string;
  contactEmail: string;
  timezone: string;
}

export const timezoneOptions = (
  current: string,
  available: string[] = Intl.supportedValuesOf("timeZone"),
): string[] => {
  const zones = new Set(
    available.map((zone) => LEGACY_ZONE_NAMES[zone] ?? zone),
  );
  zones.add("UTC");
  zones.add(current);
  return [...zones].sort((a, b) => a.localeCompare(b));
};

export const toFormValues = (
  profile: IOrganizationProfile,
): OrganizationFormValues => ({
  name: profile.name,
  taxCode: profile.taxCode,
  address: profile.address,
  contactPhone: profile.contactPhone,
  contactEmail: profile.contactEmail ?? "",
  timezone: profile.timezone,
});

export const changedFields = (
  profile: IOrganizationProfile,
  values: OrganizationFormValues,
): IUpdateOrganizationReq => {
  const body: IUpdateOrganizationReq = {};
  const name = normalizeText(values.name);
  const taxCode = values.taxCode.replace(/\s+/g, "");
  const address = normalizeText(values.address);
  const contactPhone = values.contactPhone.trim();
  const contactEmail = normalizeEmail(values.contactEmail) || null;
  if (name !== profile.name) body.name = name;
  if (taxCode !== profile.taxCode) body.taxCode = taxCode;
  if (address !== profile.address) body.address = address;
  if (contactPhone !== profile.contactPhone) body.contactPhone = contactPhone;
  if (contactEmail !== profile.contactEmail) body.contactEmail = contactEmail;
  if (values.timezone !== profile.timezone) body.timezone = values.timezone;
  return body;
};

export const logoFileError = (file: { type: string; size: number }) => {
  if (!["image/png", "image/jpeg"].includes(file.type))
    return "Logo phải là ảnh PNG hoặc JPEG.";
  if (file.size > LOGO_MAX_BYTES) return "Logo tối đa 2 MB.";
  return null;
};

export const organizationErrorMessage = (
  status: number,
  code: string | undefined,
): string => {
  switch (code) {
    case "INVALID_TIMEZONE":
      return "Hãy chọn múi giờ trong danh sách.";
    case "LOGO_INVALID":
      return "Logo phải là ảnh PNG hoặc JPEG.";
    case "FILE_TOO_LARGE":
      return "Logo quá lớn. Logo tối đa 2 MB.";
    case "STORAGE_UNAVAILABLE":
      return "Hiện chưa tải logo lên được. Vui lòng thử lại sau.";
    case "SUBSCRIPTION_NOT_ACTIVE":
      return "Gói dịch vụ đang tạm ngưng nên thông tin tổ chức chỉ xem được.";
    case "ORGANIZATION_NOT_ACTIVE":
      return "Tổ chức của bạn không ở trạng thái hoạt động nên không sửa được thông tin.";
    default:
      return status === 400
        ? "Một số giá trị chưa hợp lệ. Hãy kiểm tra lại biểu mẫu."
        : "Chưa lưu được thay đổi. Vui lòng thử lại sau.";
  }
};
