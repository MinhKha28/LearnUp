/** Kết quả một lần chạy bootstrap Admin; không chứa mật khẩu. */
export interface IBootstrapAdminResult {
  adminId: string;
  email: string;
  adminCreated: boolean;
  platformSettingsCreated: boolean;
}
