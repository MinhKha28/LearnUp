import { ApiError } from "@/types/api.types";

export const progressFailureAction = (error: unknown): "retain" | "suspend" | "delete" => {
  if (!(error instanceof ApiError)) return "retain";
  if (error.status === 403 && error.code === "CONTENT_UNAVAILABLE") return "suspend";
  if (error.status === 422 || (error.status === 404
    && ["ENROLLMENT_NOT_FOUND", "MATERIAL_NOT_FOUND"].includes(error.code))
    || (error.status === 409 && error.code === "MATERIAL_NOT_VIDEO")) return "delete";
  return "retain";
};
