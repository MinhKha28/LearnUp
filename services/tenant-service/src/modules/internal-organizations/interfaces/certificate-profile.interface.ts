import { ICertificateLogo } from './certificate-logo.interface';

/** Thông tin tổ chức achievement-reporting chụp vào Certificate khi cấp (BR-263, BR-270); timezone để tính ngày cấp. */
export interface ICertificateProfile {
  organizationId: string;
  name: string;
  logo: ICertificateLogo | null;
  timezone: string;
}
