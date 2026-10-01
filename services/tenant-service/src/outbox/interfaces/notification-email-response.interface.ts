/**
 * Body notification-service trả về cho POST /api/notifications/email/send
 * (ApiResponse của java-common, bọc EmailLogResponse).
 * Lưu ý: lỗi SMTP vẫn trả HTTP 201, chỉ khác data.status = 'FAILED'.
 */
export interface NotificationEmailResponse {
  success: boolean;
  data?: {
    id: string;
    recipientEmail: string;
    status: 'SENT' | 'FAILED';
    errorMessage: string | null;
  };
}
