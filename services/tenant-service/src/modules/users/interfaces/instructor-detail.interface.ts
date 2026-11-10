import type { IManagedCourseChain } from '../../../infrastructure/clients/course/interfaces/managed-course-chain.interface';

// UC12.1: lời mời đang mở của tài khoản Pending. Không chứa token / mã băm / liên kết.
export interface InstructorInvitation {
  sentAt: Date; // = account_tokens.created_at (BR-278: phát lại thì token cũ bị thu hồi, token mới thay thế)
  expiresAt: Date;
}

// UC12.1 - Xem chi tiết Instructor.
export interface InstructorDetail {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  department: string | null;
  status: string; // Pending | Active | Deactivated
  activatedAt: Date | null;
  createdAt: Date;
  // Cùng cách tính với danh sách UC12: Pending mà không còn lời mời hiệu lực (BR-22, BR-278).
  invitationExpired: boolean;
  // Chỉ khi Pending và có token Invitation đang mở (chưa dùng, chưa thu hồi); còn lại null.
  invitation: InstructorInvitation | null;
  // [] khi không phụ trách chuỗi nào; null khi không hỏi được course-service.
  courses: IManagedCourseChain[] | null;
  // GĐ2: số vi phạm đã xác nhận (BR-251) do course-service sở hữu. Kỳ 8 luôn null.
  violations: null;
}
