export interface TenantInstructor {
  id: string;
  fullName: string;
}

export interface TenantApiResponse<T> {
  data?: T;
}
