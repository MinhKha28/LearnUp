import { App, Form, Input } from "antd";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
} from "@/components/organizer/organizer.ui";
import {
  createInstructorAPI,
  getInstructorSeatsAPI,
} from "@/services/organization.service";
import type { IApiError, ISeatUsage } from "@/types/organization.types";
import {
  normalizeEmail,
  normalizeText,
  seatBlockReason,
  textRule,
} from "@/utils/helper";
import "./instructor.create.scss";
import { VietnameseAlert } from "@/components/vietnamese.controls";

type InstructorFields = {
  fullName: string;
  email: string;
  department?: string;
};

const LIST_PATH = "/organizer/instructors";

const InstructorCreate = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [form] = Form.useForm<InstructorFields>();
  const [seats, setSeats] = useState<ISeatUsage | null>(null);
  const [seatsLoading, setSeatsLoading] = useState(true);
  const [seatsKey, setSeatsKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // UC12.2 - số chỗ còn lại (BR-23); tải lại sau khi backend báo hết chỗ / Subscription đổi trạng thái
  useEffect(() => {
    let ignore = false;
    const loadSeats = async () => {
      setSeatsLoading(true);
      try {
        const res = await getInstructorSeatsAPI();
        if (!ignore) setSeats(res.data ?? null);
      } catch {
        if (!ignore) setSeats(null);
      } finally {
        if (!ignore) setSeatsLoading(false);
      }
    };
    loadSeats();
    return () => {
      ignore = true;
    };
  }, [seatsKey]);

  const blockedReason = seatsLoading
    ? null
    : seatBlockReason(seats, "Giảng viên");
  const locked = seatsLoading || blockedReason !== null;

  async function submit(values: InstructorFields) {
    if (submitting) return; // chống bấm 2 lần
    setSubmitting(true);
    setSubmitError(null);
    try {
      const department = normalizeText(values.department);
      const res = await createInstructorAPI({
        fullName: normalizeText(values.fullName),
        email: normalizeEmail(values.email),
        department: department === "" ? null : department,
      });
      if (res.data?.id) {
        message.success(
          `Đã tạo tài khoản giảng viên. Email mời sẽ được gửi đến ${res.data.email}.`,
        );
        navigate(LIST_PATH);
      } else {
        showCreateError((res as unknown as { error?: IApiError }).error);
      }
    } catch {
      setSubmitError("Không kết nối được với máy chủ. Vui lòng thử lại sau.");
    } finally {
      setSubmitting(false);
    }
  }

  // UC12.2: đổi mã lỗi backend thành thông báo tiếng Anh, đặt đúng chỗ
  function showCreateError(error?: IApiError) {
    switch (error?.code) {
      case "EMAIL_ALREADY_USED":
        form.setFields([
          {
            name: "email",
            errors: ["Email này đã được tài khoản khác sử dụng."],
          },
        ]);
        return;
      case "SEAT_LIMIT_REACHED":
        setSubmitError(
          "Đã dùng hết suất giảng viên. Hãy giải phóng một suất hoặc nâng cấp gói dịch vụ để thêm giảng viên.",
        );
        setSeatsKey((key) => key + 1);
        return;
      case "SUBSCRIPTION_NOT_ACTIVE":
        setSubmitError(
          "Gói dịch vụ chưa hoạt động. Không thể tạo tài khoản mới.",
        );
        setSeatsKey((key) => key + 1);
        return;
      case "ORGANIZATION_NOT_ACTIVE":
        setSubmitError(
          "Tổ chức đang bị tạm ngưng. Không thể tạo tài khoản mới.",
        );
        setSeatsKey((key) => key + 1);
        return;
      case "FORBIDDEN":
        setSubmitError("Bạn không có quyền thêm giảng viên.");
        return;
      default:
        setSubmitError(
          "Một số thông tin chưa hợp lệ. Vui lòng kiểm tra và thử lại.",
        );
    }
  }

  return (
    <OrganizerPage className="organizer-instructor-create">
      <PageHeader
        title="Thêm giảng viên"
        subtitle="Tạo lời mời để giảng viên tự đặt mật khẩu."
        actions={
          <>
            <OrganizerButton onClick={() => navigate(LIST_PATH)}>
              Hủy
            </OrganizerButton>
            <OrganizerButton
              type="primary"
              htmlType="submit"
              form="instructor-create-form"
              loading={submitting}
              disabled={locked}
            >
              Gửi lời mời
            </OrganizerButton>
          </>
        }
      />
      <SectionCard title="Giảng viên mới">
        <Form<InstructorFields>
          form={form}
          id="instructor-create-form"
          className="organizer-form"
          layout="vertical"
          disabled={locked || submitting}
          onFinish={submit}
        >
          <div className="organizer-form-grid">
            <Form.Item
              label="Họ và tên"
              name="fullName"
              rules={[
                {
                  required: true,
                  whitespace: true,
                  message: "Nhập họ và tên.",
                },
                { validator: textRule("Họ và tên", 100) },
              ]}
            >
              <Input placeholder="An Nguyễn" maxLength={100} />
            </Form.Item>
            <Form.Item
              label="Email"
              name="email"
              normalize={(value: string) => value.trimStart()}
              rules={[
                { required: true, message: "Nhập địa chỉ email." },
                { type: "email", message: "Nhập địa chỉ email hợp lệ." },
                { max: 254, message: "Email có tối đa 254 ký tự." },
              ]}
            >
              <Input
                placeholder="an.nguyen@example.com"
                maxLength={254}
                autoComplete="off"
              />
            </Form.Item>
            <Form.Item
              label="Đơn vị công tác (Không bắt buộc)"
              name="department"
              rules={[{ validator: textRule("Đơn vị công tác", 100) }]}
            >
              <Input placeholder="Kỹ thuật" maxLength={100} />
            </Form.Item>
            <Form.Item
              label={<span style={{ visibility: "hidden" }}>Kiểm tra số chỗ còn lại</span>}
              colon={false}
            >
              <div className="organizer-seat-check">
                <span>Kiểm tra số chỗ còn lại</span>
                <strong>
                  {seatsLoading
                    ? "Đang kiểm tra số suất còn lại…"
                    : seats
                      ? `Còn ${seats.remaining} suất giảng viên (đã dùng ${seats.used}/${seats.max})`
                      : "Chưa có thông tin về số suất tài khoản"}
                </strong>
              </div>
            </Form.Item>
          </div>
          {blockedReason ? (
            <VietnameseAlert
              type="warning"
              showIcon
              message="Hiện không thể thêm giảng viên."
              description={blockedReason}
            />
          ) : (
            <VietnameseAlert
              type="success"
              showIcon
              message="Giảng viên sẽ nhận được email và tự đặt mật khẩu qua liên kết mời."
            />
          )}
          {submitError && (
            <VietnameseAlert type="error" showIcon message={submitError} />
          )}
        </Form>
      </SectionCard>
    </OrganizerPage>
  );
};

export default InstructorCreate;
