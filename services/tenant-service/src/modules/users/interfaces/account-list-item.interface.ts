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

// UC13: tình trạng đào tạo do learning-service sở hữu. null khi không hỏi được learning-service.
export interface LearnerListItem extends AccountListItem {
  // Enrollment đang dở (NotStarted + InProgress, kể cả quá hạn), cả Required lẫn Optional.
  activeCourseCount: number | null;
  // Enrollment Required đang quá hạn (BR-144); tài khoản vô hiệu hóa = 0 (BR-38).
  overdueCourseCount: number | null;
}
