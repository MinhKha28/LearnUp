// Một dòng trong danh sách tài khoản của tổ chức (dùng chung UC12, UC13).
export interface AccountListItem {
  id: string;
  fullName: string;
  email: string;
  department: string | null;
  status: string; // Pending | Active | Deactivated
  activatedAt: Date | null;
  createdAt: Date;
  // Tính lúc đọc, không lưu DB: Pending mà không còn lời mời hiệu lực (BR-22, BR-278).
  invitationExpired: boolean;
}

export interface InstructorListItem extends AccountListItem {
  // null khi không hỏi được course-service.
  managedCourseCount: number | null;
}
