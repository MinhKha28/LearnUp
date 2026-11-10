import type { AccountListItem } from './account-list-item.interface';

// UC12.3 - kết quả sửa tài khoản. Không chứa token / mã băm / liên kết.
export interface UpdateAccountResult extends AccountListItem {
  // true khi đổi email của tài khoản Pending: liên kết cũ bị thu hồi, thư mời mới đã vào outbox (BR-35).
  invitationResent: boolean;
}
