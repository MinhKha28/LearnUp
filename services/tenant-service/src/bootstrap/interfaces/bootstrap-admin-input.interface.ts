/** Thông tin để tạo Admin đầu tiên cho một stack rỗng. Mật khẩu chỉ đi tiếp sang identity, không lưu ở tenant. */
export interface IBootstrapAdminInput {
  email: string;
  fullName: string;
  password: string;
  allowAdditionalAdmin: boolean;
}
