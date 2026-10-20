import type { LearnerEnrollment } from '../../../infrastructure/clients/learning/learning-service.client';
import type { InstructorInvitation } from './instructor-detail.interface';

// UC13.1 - Xem chi tiết Learner. Ai được sửa trường nào (BR-33, BR-34) do frontend suy từ activatedAt.
export interface LearnerDetail {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  department: string | null; // BR-279: chuỗi tự do, đã chuẩn hóa khoảng trắng khi lưu
  status: string; // Pending | Active | Deactivated
  activatedAt: Date | null;
  createdAt: Date;
  // Cùng cách tính với danh sách UC13: Pending mà không còn lời mời hiệu lực (BR-22, BR-278).
  invitationExpired: boolean;
  // Chỉ khi Pending và có token Invitation đang mở; cùng dạng với UC12.1.
  invitation: InstructorInvitation | null;
  // [] khi chưa tham gia Course nào; null khi không hỏi được learning-service.
  enrollments: LearnerEnrollment[] | null;
}
