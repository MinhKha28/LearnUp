// Kiểu response chung của Notification Service.
export interface ApiResponse<T> {
  data?: T;
}

// Giá trị trả về từ API gửi email.
export type EmailStatus = 'SENT' | 'SIMULATED' | 'FAILED';

export interface EmailResponse {
  id: string;
  status: EmailStatus;
}

// Giá trị trả về từ API tạo in-app notification.
export interface NotificationResponse {
  id: string;
}
