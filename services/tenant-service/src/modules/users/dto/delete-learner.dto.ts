import { PickType } from '@nestjs/swagger';
import { DeleteAccountDto } from './delete-account.dto';

// UC13.6 - Xóa Learner. Chỉ có lý do tùy chọn (BR-271), cùng validate với UC12.6; Learner không có
// chuyển quyền phụ trách (BR-41 chỉ cho Instructor) nên gửi receiverInstructorId -> 400 (forbidNonWhitelisted).
export class DeleteLearnerDto extends PickType(DeleteAccountDto, [
  'reason',
] as const) {}
