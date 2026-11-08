import { ApiProperty, PickType } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { DeleteAccountDto } from './delete-account.dto';

export const AccountStatusAction = {
  Deactivate: 'DEACTIVATE',
  Reactivate: 'REACTIVATE',
} as const;

export type AccountStatusActionValue =
  (typeof AccountStatusAction)[keyof typeof AccountStatusAction];

// UC12.5 - Đổi trạng thái Instructor. BR-36, BR-41, BR-271 (lý do tùy chọn với hành động này).
// receiverInstructorId (chỉ dùng khi DEACTIVATE, REACTIVATE bỏ qua) và reason dùng chung với UC12.6.
export class ChangeAccountStatusDto extends DeleteAccountDto {
  @ApiProperty({ enum: Object.values(AccountStatusAction) })
  @IsIn(Object.values(AccountStatusAction), {
    message: 'action phải là DEACTIVATE hoặc REACTIVATE',
  })
  action!: AccountStatusActionValue;
}

// UC13.5 - Đổi trạng thái Learner. Cùng action / reason (cùng validate) với UC12.5; Learner không có
// chuyển quyền phụ trách (BR-41 chỉ cho Instructor) nên gửi receiverInstructorId -> 400 (forbidNonWhitelisted).
export class ChangeLearnerStatusDto extends PickType(ChangeAccountStatusDto, [
  'action',
  'reason',
] as const) {}
