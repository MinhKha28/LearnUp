export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
  templateCode: string;
  /** Hạn của mã hoặc liên kết trong thư (ISO 8601); quá hạn thì relay bỏ thư, không gửi. */
  expiresAt?: string;
  /** Thư tính vào giới hạn gửi lại theo email trong 24 giờ (BR-40); thư đầu của đăng ký không tính. */
  countsTowardResendLimit?: boolean;
}
