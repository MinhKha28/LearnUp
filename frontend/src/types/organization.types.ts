export interface IOrganization {
  id: string;
  name: string;
  timezone: string;
}

// UC01 - dữ liệu một gói do GET /api/v1/subscription-plans trả về
export interface ISubscriptionPlan {
  id: string;
  name: string;
  price: number;
  durationDays: number;
  maxLearners: number;
  maxInstructors: number;
  maxCourseChains: number;
  maxStorageBytes: number;
}

// UC02 - body gửi lên POST /api/v1/registrations (khớp CreateRegistrationDto ở backend)
export interface ICreateRegistrationReq {
  planId: string;
  organization: {
    name: string;
    taxCode: string;
    address: string;
    contactPhone: string;
  };
  organizer: {
    fullName: string;
    email: string;
    password: string;
  };
}

// UC02 - backend trả 1 trong 2 dạng, phân biệt bằng trường "resent"
export type ICreateRegistrationRes =
  | {
      resent: false;
      registrationId: string;
      paymentToken: string;
      expiresAt: string;
    }
  | { resent: true; message: string };

// Lỗi tenant-service: { code, message } (lỗi nghiệp vụ) hoặc { message: [...] } (lỗi DTO)
export interface IApiError {
  code?: string;
  message: string | string[];
}
