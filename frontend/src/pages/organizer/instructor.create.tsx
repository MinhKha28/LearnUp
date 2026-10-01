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
  createInstructorAPI,
  getInstructorSeatsAPI,
} from "@/services/organization.service";
import type { IApiError, ISeatUsage } from "@/types/organization.types";
import { seatBlockReason } from "@/utils/helper";
import "./instructor.create.scss";

type InstructorFields = {
  fullName: string;
  email: string;
  department?: string;
};

const LIST_PATH = "/organizer/instructors";

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
      return Promise.reject(new Error(`${label} must be at most ${max} characters.`));
    if (CONTROL_CHARS.test(normalized))
      return Promise.reject(new Error(`${label} contains invalid characters.`));
    if (ANGLE_BRACKETS.test(normalized))
      return Promise.reject(new Error(`${label} cannot contain < or >.`));
    return Promise.resolve();
  };

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
    : seatBlockReason(seats, "Instructor");
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
          `Instructor account created. An invitation email will be sent to ${res.data.email}.`,
        );
        navigate(LIST_PATH);
      } else {
        showCreateError((res as unknown as { error?: IApiError }).error);
      }
    } catch {
      setSubmitError("Could not connect to the server. Please try again later.");
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
            errors: ["This email is already used by another account."],
          },
        ]);
        return;
      case "SEAT_LIMIT_REACHED":
        setSubmitError(
          "All Instructor seats are in use. Free a seat or upgrade your Subscription to add more Instructors.",
        );
        setSeatsKey((key) => key + 1);
        return;
      case "SUBSCRIPTION_NOT_ACTIVE":
        setSubmitError(
          "Your Subscription is not active. New accounts cannot be created.",
        );
        setSeatsKey((key) => key + 1);
        return;
      case "ORGANIZATION_NOT_ACTIVE":
        setSubmitError(
          "Your Organization is suspended. New accounts cannot be created.",
        );
        setSeatsKey((key) => key + 1);
        return;
      case "FORBIDDEN":
        setSubmitError("You do not have permission to add Instructors.");
        return;
      default:
        setSubmitError(
          "Some details are invalid. Please review them and try again.",
        );
    }
  }

  return (
    <OrganizerPage className="organizer-instructor-create">
      <PageHeader
        title="Add Instructor"
        subtitle="Create an invitation. Organizer does not set the Instructor password."
        actions={
          <>
            <OrganizerButton onClick={() => navigate(LIST_PATH)}>
              Cancel
            </OrganizerButton>
            <OrganizerButton
              type="primary"
              htmlType="submit"
              form="instructor-create-form"
              loading={submitting}
              disabled={locked}
            >
              Send invitation
            </OrganizerButton>
          </>
        }
      />
      <SectionCard title="New Instructor">
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
              label="Full name"
              name="fullName"
              rules={[
                {
                  required: true,
                  whitespace: true,
                  message: "Enter the full name.",
                },
                { validator: textRule("Full name", 100) },
              ]}
            >
              <Input placeholder="An Nguyen" maxLength={100} />
            </Form.Item>
            <Form.Item
              label="Email"
              name="email"
              normalize={(value: string) => value.trimStart()}
              rules={[
                { required: true, message: "Enter the email address." },
                { type: "email", message: "Enter a valid email address." },
                { max: 254, message: "Email must be at most 254 characters." },
              ]}
            >
              <Input
                placeholder="an.nguyen@example.com"
                maxLength={254}
                autoComplete="off"
              />
            </Form.Item>
            <Form.Item
              label="Department (optional)"
              name="department"
              rules={[{ validator: textRule("Department", 100) }]}
            >
              <Input placeholder="Engineering" maxLength={100} />
            </Form.Item>
            <Form.Item
              label={<span style={{ visibility: "hidden" }}>Seat check</span>}
              colon={false}
            >
              <div className="organizer-seat-check">
                <span>Seat check</span>
                <strong>
                  {seatsLoading
                    ? "Checking available seats…"
                    : seats
                      ? `${seats.remaining} Instructor ${seats.remaining === 1 ? "seat" : "seats"} remaining (${seats.used} / ${seats.max} used)`
                      : "Seat information unavailable"}
                </strong>
              </div>
            </Form.Item>
          </div>
          {blockedReason ? (
            <Alert
              type="warning"
              showIcon
              message="You cannot add Instructors right now."
              description={blockedReason}
            />
          ) : (
            <Alert
              type="success"
              showIcon
              message="The Instructor will receive an email and set their own password through the invitation link."
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

export default InstructorCreate;
