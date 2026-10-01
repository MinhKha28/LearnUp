import { useNavigate } from "react-router-dom";

import { LearnerEmptyState, LearnerErrorState } from "@/components/learner/learner.states";
import { LearnerButton } from "@/components/learner/learner.ui";
import type { ApiError } from "@/types/api.types";
import { mapLearningError } from "@/utils/curriculum.view";
import { LEARNER_ROUTES } from "@/utils/learner.routes";

/** Lỗi của UC27, UC27.1 theo mapLearningError: lỗi nghiệp vụ kèm nút điều hướng, lỗi khác kèm Thử lại nếu được. */
export const LearningError = ({
  error,
  context,
  enrollmentId,
  onRetry,
}: {
  error: ApiError;
  context: "curriculum" | "lesson";
  enrollmentId: string;
  onRetry: () => void;
}) => {
  const navigate = useNavigate();
  const view = mapLearningError(error, context);

  if (view.action === "myCourses" || view.action === "curriculum") {
    const target =
      view.action === "myCourses"
        ? { label: "Về Course của tôi", to: LEARNER_ROUTES.myCourses() }
        : { label: "Về chương trình học", to: LEARNER_ROUTES.curriculum(enrollmentId) };
    return (
      <LearnerEmptyState
        title={view.title}
        description={view.description ?? undefined}
        action={<LearnerButton onClick={() => navigate(target.to)}>{target.label}</LearnerButton>}
      />
    );
  }

  return (
    <LearnerErrorState
      error={error}
      title={view.title}
      message={view.description ?? undefined}
      onRetry={view.action === "retry" ? onRetry : undefined}
    />
  );
};
