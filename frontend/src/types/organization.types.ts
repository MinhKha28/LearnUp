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
