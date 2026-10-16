import { Alert, Button } from "antd";
import type { ApiError } from "@/types/api.types";
import { assignmentErrorMessage } from "@/utils/assignments.view";

export const AssignmentError = ({
  error,
  retry,
}: {
  error: ApiError;
  retry?: () => void;
}) => (
  <Alert
    type="error"
    showIcon
    message={assignmentErrorMessage(error.code)}
    action={retry && <Button onClick={retry}>Thử lại</Button>}
  />
);
