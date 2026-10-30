import type { ICreatePlanReq } from "@/types/organization.types";

export const BYTES_PER_GB = 1024 ** 3;

export const PLAN_LIMITS = {
  price: 1_000_000_000_000,
  durationDays: 3650,
  maxLearners: 1_000_000,
  maxInstructors: 100_000,
  maxCourseChains: 100_000,
  minStorageGb: 0.1,
  maxStorageGb: Math.floor(Number.MAX_SAFE_INTEGER / BYTES_PER_GB),
} as const;

export interface PlanFormValues {
  name: string;
  price: number;
  durationDays: number;
  maxLearners: number;
  maxInstructors: number;
  maxCourseChains: number;
  storageGb: number;
}

export const toCreatePlanBody = (values: PlanFormValues): ICreatePlanReq => ({
  name: values.name.trim().replace(/\s+/g, " "),
  price: values.price,
  durationDays: values.durationDays,
  maxLearners: values.maxLearners,
  maxInstructors: values.maxInstructors,
  maxCourseChains: values.maxCourseChains,
  maxStorageBytes: Math.round(values.storageGb * BYTES_PER_GB),
});

export const planErrorMessage = (
  status: number,
  code: string | undefined,
): string => {
  if (code === "PLAN_NAME_TAKEN")
    return "A plan with this name already exists.";
  if (status === 400)
    return "Some values are not valid. Please check the form.";
  if (status === 401 || status === 403)
    return "Only platform Admins can manage Subscription Plans.";
  return "Could not save the plan. Please try again later.";
};

export const organizationsUsingLabel = (count: number): string =>
  count === 0
    ? "No Organization is using this plan"
    : count === 1
      ? "1 Organization currently using"
      : `${count} Organizations currently using`;
