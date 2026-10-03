export interface IRegistrationSummary {
  registrationId: string;
  status: string; // PendingPayment | Paid
  expiresAt: Date;
  organizationName: string;
  organizerEmail: string;
  plan: {
    name: string;
    price: number; // giá đã chốt lúc đăng ký (BR-275), không phải giá gói hiện tại
    durationDays: number;
    maxLearners: number;
    maxInstructors: number;
    maxCourseChains: number;
    maxStorageBytes: number;
  };
}
