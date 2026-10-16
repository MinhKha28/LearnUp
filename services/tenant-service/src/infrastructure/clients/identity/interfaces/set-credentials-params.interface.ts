import { UserRoleValue } from '../../../../common/constants/tenant.constants';

/** Dữ liệu gửi sang identity-service để tạo hoặc cập nhật thông tin đăng nhập. */
export interface ISetCredentialsParams {
  userId: string;
  password: string;
  email: string;
  fullName: string;
  role: (typeof UserRoleValue)[keyof typeof UserRoleValue];
  organizationId: string | null;
}
