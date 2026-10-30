import { Alert, Button, DatePicker, Form, Input, Modal, message } from "antd";
import viVN from "antd/locale/vi_VN";
import "dayjs/locale/vi";
import dayjs, { type Dayjs } from "dayjs";
import { useRef, useState } from "react";
import { AssignmentError } from "@/components/organizer/assignment.error";
import { toApiError } from "@/services/api.client";
import {
  exemptAssignment,
  extendAssignment,
} from "@/services/assignment.service";
import type { ApiError } from "@/types/api.types";
import type { AssignmentDetail } from "@/types/assignment.types";
import {
  assignmentErrorMessage,
  assignmentExtensionRange,
  canExemptAssignment,
  canExtendAssignment,
  extensionDateError,
} from "@/utils/assignments.view";
import { assignmentDueDate, assignmentExtensionDeadline } from "@/utils/assignment.date";
import { formatTimezone } from "@/utils/timezone.format";
import "./assignment.change.scss";

export const AssignmentChange = ({
  item,
  onChanged,
  onConflict,
  onReload,
}: {
  item: AssignmentDetail;
  onChanged: (item: AssignmentDetail) => void;
  onConflict: (error: ApiError) => void;
  onReload: () => void;
}) => {
  const [mode, setMode] = useState<"extend" | "exempt" | null>(null);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [form] = Form.useForm<{ newDueDate: Dayjs; reason?: string }>();
  const selectedDay: Dayjs | undefined = Form.useWatch("newDueDate", form);
  const [notice, contextHolder] = message.useMessage();
  const pickerTimezone = item.organizationTimezone ?? item.dueTimezone;
  const range = assignmentExtensionRange(item.dueAt, pickerTimezone);
  const newDeadline = selectedDay
    ? assignmentExtensionDeadline(selectedDay.format("YYYY-MM-DD"), pickerTimezone)
    : new Date();
  const showSummaryZones = Boolean(item.organizationTimezone && item.dueTimezone &&
    item.organizationTimezone !== item.dueTimezone);
  const open = (value: "extend" | "exempt") => {
    setError(null);
    form.resetFields();
    setMode(value);
  };
  const submit = async () => {
    if (submitting.current || !mode) return;
    submitting.current = true;
    let values;
    try {
      values = await form.validateFields();
    } catch {
      submitting.current = false;
      return;
    }
    setPending(true);
    setError(null);
    try {
      const reason = (values.reason ?? "").normalize("NFC").trim();
      const result =
        mode === "extend"
          ? await extendAssignment(
              item.enrollmentId,
              values.newDueDate.format("YYYY-MM-DD"),
              reason,
            )
          : await exemptAssignment(item.enrollmentId, reason);
      onChanged(result);
      setMode(null);
      void notice.success(
        mode === "extend" ? "Đã kéo dài hạn." : "Đã đánh dấu Miễn.",
      );
    } catch (cause) {
      const apiError = toApiError(cause);
      if (
        ["DUE_DATE_NOT_LATER", "DUE_DATE_IN_PAST"].includes(
          apiError.code,
        )
      ) {
        onReload();
        form.setFields([
          {
            name: "newDueDate",
            errors: [assignmentErrorMessage(apiError.code)],
          },
        ]);
      } else if (
        ["ENROLLMENT_NOT_EXTENDABLE", "ENROLLMENT_NOT_EXEMPTIBLE"].includes(
          apiError.code,
        )
      ) {
        setMode(null);
        onConflict(apiError);
      } else setError(apiError);
    } finally {
      submitting.current = false;
      setPending(false);
    }
  };
  return (
    <>
      {contextHolder}
      {canExtendAssignment(item.status) && (
        <Button disabled={pending} onClick={() => open("extend")}>
          Kéo dài hạn
        </Button>
      )}
      {canExemptAssignment(item) && (
        <Button disabled={pending} onClick={() => open("exempt")}>
          Đánh dấu Miễn
        </Button>
      )}
      <Modal
        title={mode === "extend" ? "Kéo dài hạn" : "Đánh dấu Miễn"}
        open={mode !== null}
        onCancel={() => {
          if (!submitting.current) setMode(null);
        }}
        maskClosable={!pending}
        closable={!pending}
        footer={
          <>
            <Button disabled={pending} onClick={() => setMode(null)}>
              Hủy
            </Button>
            <Button
              type="primary"
              loading={pending}
              onClick={submit}
            >
              {mode === "extend" ? "Kéo dài hạn" : "Đánh dấu Miễn"}
            </Button>
          </>
        }
      >
        {error && <AssignmentError error={error} retry={submit} />}
        {mode === "exempt" && (
          <Alert
            type="info"
            showIcon
            message="Học viên không còn bị tính quá hạn và vẫn có thể học tiếp. Khóa học vẫn là bắt buộc, không chuyển về tự chọn."
          />
        )}
        {mode === "extend" && (
          <>
            <p>
              Hạn hiện tại:{" "}
              {assignmentDueDate(item.dueAt, item.dueTimezone)}
              {showSummaryZones && ` (${formatTimezone(item.dueTimezone!, new Date(item.dueAt ?? Date.now()))})`}
              {" → Hạn mới: "}
              {selectedDay
                ? selectedDay.format("DD/MM/YYYY")
                : "Chưa chọn"}
              {showSummaryZones && ` (${formatTimezone(pickerTimezone!, newDeadline)})`}
            </p>
            {item.organizationTimezone && item.organizationTimezone !== item.dueTimezone && (
              <p>Hạn mới được tính theo múi giờ hiện tại của tổ chức: {formatTimezone(item.organizationTimezone, newDeadline)}</p>
            )}
            {!pickerTimezone && (
              <Alert
                type="info"
                showIcon
                message="Giới hạn ngày tính theo giờ trên máy bạn vì chưa lấy được múi giờ tổ chức. Hạn sẽ được kiểm tra khi gửi."
              />
            )}
          </>
        )}
        <Form
          form={form}
          layout="vertical"
          disabled={pending}
          className="organizer-assignment-change-form"
        >
          {mode === "extend" && (
            <Form.Item
              name="newDueDate"
              label="Ngày hết hạn mới"
              rules={[
                { required: true, message: "Hãy chọn ngày hết hạn mới." },
                {
                  validator: (_, value: Dayjs | undefined) => {
                    if (!value) return Promise.resolve();
                    const code = extensionDateError(
                      value.format("YYYY-MM-DD"),
                      item.dueAt,
                      pickerTimezone,
                    );
                    return code
                      ? Promise.reject(new Error(assignmentErrorMessage(code)))
                      : Promise.resolve();
                  },
                },
              ]}
            >
              <DatePicker
                locale={viVN.DatePicker}
                format="DD/MM/YYYY"
                placeholder="Chọn ngày"
                minDate={dayjs(range.min)}
                disabledDate={(value) =>
                  value.format("YYYY-MM-DD") < range.min
                }
              />
            </Form.Item>
          )}
          <Form.Item
            name="reason"
            label={
              mode === "exempt" ? "Lý do (bắt buộc)" : "Lý do (không bắt buộc)"
            }
            rules={[
              {
                validator: (_, value: string | undefined) => {
                  const reason = (value ?? "").normalize("NFC").trim();
                  if (mode === "exempt" && reason.length === 0)
                    return Promise.reject(
                      new Error(
                        "Hãy nhập lý do từ 1 đến 1000 ký tự sau khi cắt khoảng trắng hai đầu.",
                      ),
                    );
                  return reason.length > 1000
                    ? Promise.reject(new Error("Lý do tối đa 1000 ký tự."))
                    : Promise.resolve();
                },
              },
            ]}
          >
            <Input.TextArea rows={4} maxLength={1000} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};
