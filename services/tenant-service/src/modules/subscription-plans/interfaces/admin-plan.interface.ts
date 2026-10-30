import { PlanResponse } from './subscription-plan.interface';

/** UC43: cấu hình gói, trạng thái cung cấp và số Organization đang dùng. */
export interface IAdminPlan extends PlanResponse {
  isOffered: boolean;
  organizationCount: number;
  createdAt: Date;
}
