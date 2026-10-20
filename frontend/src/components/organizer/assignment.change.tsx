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
import { assignmentDueDate } from "@/utils/assignment.date";
import "./assignment.change.scss";

export const AssignmentChange = ({
  item,
  onChanged,
  onConflict,
}: {
  item: AssignmentDetail;
  onChanged: (item: AssignmentDetail) => void;
  onConflict: (error: ApiError) => void;
}) => {
  const [mode, setMode] = useState<"extend" | "exempt" | null>(null);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [form] = Form.useForm<{ newDueDate: Dayjs; reason?: string }>();
  const selectedDay: Dayjs | undefined = Form.useWatch("newDueDate", form);
  const [notice, contextHolder] = message.useMessage();
  const range = assignmentExtensionRange(item.dueAt, item.organizationTimezone);
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
        ["DUE_DATE_NOT_LATER", "DUE_DATE_IN_PAST", "DUE_DATE_TOO_FAR"].includes(
          apiError.code,
        )
      ) {
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
              disabled={mode === "extend" && range.min > range.max}
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
              {assignmentDueDate(item.dueAt, item.organizationTimezone)} → Hạn mới:{" "}
              {selectedDay
                ? selectedDay.format("DD/MM/YYYY")
                : "Chưa chọn"}
            </p>
            {!item.organizationTimezone && (
              <Alert
                type="info"
                showIcon
                message="Giới hạn ngày tính theo giờ trên máy bạn vì chưa lấy được múi giờ tổ chức. Hạn sẽ được kiểm tra khi gửi."
              />
            )}
            {range.min > range.max && (
              <Alert
                type="warning"
                showIcon
                message="Không có ngày hợp lệ trong giới hạn 365 ngày kể từ hôm nay."
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
                      item.organizationTimezone,
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
                maxDate={dayjs(range.max)}
                disabledDate={(value) =>
                  value.format("YYYY-MM-DD") < range.min ||
                  value.format("YYYY-MM-DD") > range.max
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
