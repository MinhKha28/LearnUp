import { Button } from "antd";
import type { ApiError } from "@/types/api.types";
import { assignmentErrorMessage } from "@/utils/assignments.view";
import { VietnameseAlert } from "@/components/vietnamese.controls";

export const AssignmentError = ({
  error,
  retry,
}: {
  error: ApiError;
  retry?: () => void;
}) => (
  <VietnameseAlert
    type="error"
    showIcon
    message={assignmentErrorMessage(error.code)}
    action={retry && <Button onClick={retry}>Thử lại</Button>}
  />
);
