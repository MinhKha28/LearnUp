export interface TenantInstructor {
  id: string;
  fullName: string;
}

export interface TenantApiResponse<T> {
  data?: T;
}

export interface TenantMaterialUploadPolicy {
  subscriptionStatus: string | null;
  canUpload: boolean;
  reason: string | null;
  maxStorageBytes: string;
}
