import { InstructorInvitation } from './instructor-detail.interface';

/** UC12.7, UC13.7: tài khoản vừa được phát lại lời mời; không trả token hay liên kết. */
export interface IReinvitationResult {
  id: string;
  status: string;
  invitationExpired: false;
  invitation: InstructorInvitation;
}
