/** Thông tin lời mời hiển thị trước khi đặt mật khẩu (UC04). */
export interface IInvitationInfo {
  email: string;
  fullName: string;
  role: string; // Instructor | Learner
  organizationName: string;
}
