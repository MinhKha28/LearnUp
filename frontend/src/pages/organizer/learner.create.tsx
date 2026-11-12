import { Alert, App, Form, Input } from "antd";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
} from "@/components/organizer/organizer.ui";
import {
  createLearnerAPI,
  getLearnerSeatsAPI,
} from "@/services/organization.service";
import type { IApiError, ISeatUsage } from "@/types/organization.types";
import { seatBlockReason } from "@/utils/helper";
import "./instructor.create.scss";

type LearnerFields = {
  fullName: string;
  email: string;
  department?: string;
};

const LIST_PATH = "/organizer/learners";

// Chuẩn hóa giống backend (CreateAccountDto): NFC, trim, gộp khoảng trắng; email chữ thường.
const normalizeText = (value = "") =>
  value.normalize("NFC").trim().replace(/\s+/g, " ");
const normalizeEmail = (value = "") =>
  value.normalize("NFC").trim().toLowerCase();
const CONTROL_CHARS = /\p{Cc}/u;
// Giống backend: email gửi đi bị coi là HTML nếu có cả < và >
const ANGLE_BRACKETS = /[<>]/;

// Kiểm độ dài SAU khi chuẩn hóa, giống backend
const textRule =
  (label: string, max: number) =>
  (_: unknown, value?: string) => {
    const normalized = normalizeText(value);
    if (normalized.length > max)
      return Promise.reject(new Error(`${label} tối đa ${max} ký tự.`));
    if (CONTROL_CHARS.test(normalized))
      return Promise.reject(new Error(`${label} chứa ký tự không hợp lệ.`));
    if (ANGLE_BRACKETS.test(normalized))
      return Promise.reject(new Error(`${label} không được chứa < hoặc >.`));
    return Promise.resolve();
  };

const LearnerCreate = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [form] = Form.useForm<LearnerFields>();
  const [seats, setSeats] = useState<ISeatUsage | null>(null);
  const [seatsLoading, setSeatsLoading] = useState(true);
  const [seatsKey, setSeatsKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // UC13.2 - số chỗ Learner còn lại (BR-23); tải lại sau khi backend báo hết chỗ / Subscription đổi trạng thái
  useEffect(() => {
    let ignore = false;
    const loadSeats = async () => {
      setSeatsLoading(true);
      try {
        const res = await getLearnerSeatsAPI();
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

  const blockedReason = seatsLoading ? null : seatBlockReason(seats, "Học viên");
  const locked = seatsLoading || blockedReason !== null;

  async function submit(values: LearnerFields) {
    if (submitting) return; // chống bấm 2 lần
    setSubmitting(true);
    setSubmitError(null);
    try {
      const department = normalizeText(values.department);
      const res = await createLearnerAPI({
        fullName: normalizeText(values.fullName),
        email: normalizeEmail(values.email),
        department: department === "" ? null : department,
      });
      if (res.data?.id) {
        message.success(
          `Đã tạo tài khoản học viên. Email mời sẽ được gửi đến ${res.data.email}.`,
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

  // UC13.2: đổi mã lỗi backend thành thông báo tiếng Anh, đặt đúng chỗ (giống UC12.2)
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
          "Đã dùng hết suất học viên. Hãy giải phóng một suất hoặc nâng cấp gói dịch vụ để thêm học viên.",
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
        setSubmitError("Bạn không có quyền thêm học viên.");
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
        title="Thêm học viên"
        subtitle="Tạo lời mời để học viên tự đặt mật khẩu."
        actions={
          <>
            <OrganizerButton onClick={() => navigate(LIST_PATH)}>
              Hủy
            </OrganizerButton>
            <OrganizerButton
              type="primary"
              htmlType="submit"
              form="learner-create-form"
              loading={submitting}
              disabled={locked}
            >
              Gửi lời mời
            </OrganizerButton>
          </>
        }
      />
      <SectionCard title="Học viên mới">
        <Form<LearnerFields>
          form={form}
          id="learner-create-form"
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
              <Input placeholder="Bảo Trần" maxLength={100} />
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
                placeholder="bao.tran@example.com"
                maxLength={254}
                autoComplete="off"
              />
            </Form.Item>
            <Form.Item
              label="Đơn vị công tác (Không bắt buộc)"
              name="department"
              rules={[{ validator: textRule("Đơn vị công tác", 100) }]}
            >
              <Input placeholder="Vận hành" maxLength={100} />
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
                      ? `Còn ${seats.remaining} suất học viên (đã dùng ${seats.used}/${seats.max})`
                      : "Chưa có thông tin về số suất tài khoản"}
                </strong>
              </div>
            </Form.Item>
          </div>
          {blockedReason ? (
            <Alert
              type="warning"
              showIcon
              message="Hiện không thể thêm học viên."
              description={blockedReason}
            />
          ) : (
            <Alert
              type="success"
              showIcon
              message="Học viên sẽ nhận được email và tự đặt mật khẩu qua liên kết mời."
            />
          )}
          {submitError && (
            <Alert type="error" showIcon message={submitError} />
          )}
        </Form>
      </SectionCard>
    </OrganizerPage>
  );
};

export default LearnerCreate;
