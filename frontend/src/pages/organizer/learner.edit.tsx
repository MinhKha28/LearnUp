import { Alert, App, AutoComplete, Button, Form, Input, Skeleton } from "antd";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
} from "@/components/organizer/organizer.ui";
import {
  getDepartmentSuggestionsAPI,
  getLearnerDetailAPI,
  updateLearnerAPI,
} from "@/services/organization.service";
import type {
  IApiError,
  ILearnerDetail,
  IUpdateAccountReq,
} from "@/types/organization.types";
import { normalizeEmail, normalizeText, textRule } from "@/utils/helper";
import "./learner.edit.scss";

type LearnerFields = {
  fullName: string;
  email: string;
  department?: string;
};

type LoadError = "notFound" | "failed";

// UC13.3: cùng quy tắc, cùng phạm vi sửa với UC12.3 (instructor.edit.tsx)
const LearnerEdit = () => {
  const { learnerId = "" } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [form] = Form.useForm<LearnerFields>();
  const [detail, setDetail] = useState<ILearnerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // BR-279: null = ô đơn vị công tác chưa được mở, chưa hỏi gợi ý
  const [departmentKeyword, setDepartmentKeyword] = useState<string | null>(null);
  const [departmentOptions, setDepartmentOptions] = useState<string[]>([]);
  const emailValue = Form.useWatch("email", form);

  const detailPath = `/organizer/learners/${learnerId}`;

  // Cùng cách tải với trang chi tiết UC13.1; tải lại sau khi backend báo đã kích hoạt / vừa bị sửa
  useEffect(() => {
    let ignore = false;
    const loadDetail = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await getLearnerDetailAPI(learnerId);
        if (ignore) return;
        if (res.data) {
          setDetail(res.data);
        } else {
          const status = Number(res.statusCode);
          setDetail(null);
          setLoadError(status === 400 || status === 404 ? "notFound" : "failed");
        }
      } catch {
        if (!ignore) {
          setDetail(null);
          setLoadError("failed");
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    loadDetail();
    return () => {
      ignore = true;
    };
  }, [learnerId, reloadKey]);

  // BR-279: gợi ý đơn vị công tác đã có trong tổ chức, chờ ngừng gõ 300 ms
  useEffect(() => {
    if (departmentKeyword === null) return;
    let ignore = false;
    const timer = setTimeout(async () => {
      try {
        const res = await getDepartmentSuggestionsAPI(
          normalizeText(departmentKeyword),
        );
        if (!ignore) setDepartmentOptions(Array.isArray(res.data) ? res.data : []);
      } catch {
        // Gợi ý chỉ để hỗ trợ nhập, lỗi thì bỏ qua
        if (!ignore) setDepartmentOptions([]);
      }
    }, 300);
    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [departmentKeyword]);

  // BR-34: từ khi kích hoạt, họ tên và email không do Organizer sửa
  const activated = detail?.activatedAt != null;
  const emailChanged =
    !!detail &&
    !activated &&
    !!emailValue &&
    normalizeEmail(emailValue) !== detail.email;

  async function submit(values: LearnerFields) {
    if (!detail || submitting) return; // chống bấm 2 lần
    // Chỉ gửi trường đã đổi (so sau chuẩn hóa, như backend)
    const fullName = normalizeText(values.fullName);
    const email = normalizeEmail(values.email);
    const normalizedDepartment = normalizeText(values.department);
    const department = normalizedDepartment === "" ? null : normalizedDepartment;
    const body: IUpdateAccountReq = {
      ...(!activated && fullName !== detail.fullName && { fullName }),
      ...(!activated && email !== detail.email && { email }),
      ...(department !== detail.department && { department }),
    };
    if (Object.keys(body).length === 0) {
      message.info("No changes to save.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await updateLearnerAPI(learnerId, body);
      if (res.data?.id) {
        message.success(
          res.data.invitationResent
            ? `Learner updated. A new invitation will be sent to ${res.data.email}.`
            : "Learner updated.",
        );
        navigate(detailPath);
      } else {
        showUpdateError(
          Number(res.statusCode),
          (res as unknown as { error?: IApiError }).error,
        );
      }
    } catch {
      setSubmitError("Could not connect to the server. Please try again later.");
    } finally {
      setSubmitting(false);
    }
  }

  // UC13.3: đổi mã lỗi backend thành thông báo tiếng Anh, đặt đúng chỗ
  function showUpdateError(status: number, error?: IApiError) {
    switch (error?.code) {
      case "EMAIL_ALREADY_USED":
        form.setFields([
          {
            name: "email",
            errors: ["This email is already used by another account."],
          },
        ]);
        return;
      case "ACCOUNT_ALREADY_ACTIVATED":
        setSubmitError(
          "This account has just been activated. Name and email are now managed by the Learner.",
        );
        setReloadKey((key) => key + 1);
        return;
      case "CONCURRENT_UPDATE":
        setSubmitError(
          "This learner was just updated. Please reload and try again.",
        );
        setReloadKey((key) => key + 1);
        return;
      case "LEARNER_NOT_FOUND":
        setDetail(null);
        setLoadError("notFound");
        return;
      case "ORGANIZATION_NOT_ACTIVE":
        setSubmitError(
          "Your Organization is suspended. Learner details cannot be updated.",
        );
        return;
      case "SUBSCRIPTION_NOT_ACTIVE":
        setSubmitError(
          "Your Subscription is not active. Learner details cannot be updated.",
        );
        return;
      case "FORBIDDEN":
        setSubmitError("You do not have permission to update Learners.");
        return;
      default:
        setSubmitError(
          status >= 500
            ? "Something went wrong. Please try again later."
            : "Some details are invalid. Please review them and try again.",
        );
    }
  }

  const renderBody = () => {
    if (loading) {
      return (
        <SectionCard>
          <Skeleton active />
        </SectionCard>
      );
    }
    if (loadError === "notFound") {
      return (
        <Alert
          type="warning"
          showIcon
          message="Learner not found"
          description="This learner does not exist or is no longer available in your organization."
          action={
            <Link to="/organizer/learners">
              <Button>Back</Button>
            </Link>
          }
        />
      );
    }
    if (loadError || !detail) {
      return (
        <Alert
          type="error"
          showIcon
          message="Could not load learner."
          description="Please check your connection and try again."
          action={
            <Button onClick={() => setReloadKey((key) => key + 1)}>
              Try again
            </Button>
          }
        />
      );
    }

    const lockedHint = activated
      ? "Managed by the Learner since activation."
      : undefined;
    return (
      <SectionCard title="Learner information">
        <Form<LearnerFields>
          // Tải lại thì dựng lại form theo dữ liệu mới
          key={reloadKey}
          form={form}
          id="learner-edit-form"
          className="organizer-form"
          layout="vertical"
          disabled={submitting}
          initialValues={{
            fullName: detail.fullName,
            email: detail.email,
            department: detail.department ?? "",
          }}
          onFinish={submit}
        >
          {activated && (
            <Alert
              type="info"
              showIcon
              message="This account is activated. The Learner manages their own name, and the sign-in email cannot be changed. You can still update the work unit."
            />
          )}
          <div className="organizer-form-grid">
            <Form.Item
              label="Full name"
              name="fullName"
              extra={lockedHint}
              rules={[
                {
                  required: true,
                  whitespace: true,
                  message: "Enter the full name.",
                },
                { validator: textRule("Full name", 100) },
              ]}
            >
              <Input maxLength={100} disabled={activated} />
            </Form.Item>
            <Form.Item
              label="Email"
              name="email"
              extra={lockedHint}
              normalize={(value: string) => value.trimStart()}
              rules={[
                { required: true, message: "Enter the email address." },
                { type: "email", message: "Enter a valid email address." },
                { max: 254, message: "Email must be at most 254 characters." },
              ]}
            >
              <Input maxLength={254} autoComplete="off" disabled={activated} />
            </Form.Item>
            <Form.Item
              label="Work unit (optional)"
              name="department"
              rules={[{ validator: textRule("Work unit", 100) }]}
            >
              <AutoComplete
                options={departmentOptions.map((value) => ({ value }))}
                onSearch={setDepartmentKeyword}
                onFocus={() =>
                  setDepartmentKeyword(
                    (keyword) => keyword ?? form.getFieldValue("department") ?? "",
                  )
                }
              >
                <Input placeholder="Engineering" maxLength={100} />
              </AutoComplete>
            </Form.Item>
          </div>
          {/* BR-35: đổi email làm lời mời cũ mất hiệu lực */}
          {emailChanged &&
            (detail.status === "Pending" ? (
              <Alert
                type="warning"
                showIcon
                message="Changing the email invalidates the current invitation link and sends a new invitation to the new address."
              />
            ) : (
              <Alert
                type="warning"
                showIcon
                message="Changing the email invalidates the current invitation link. No new invitation is sent while the account is deactivated."
              />
            ))}
          {submitError && <Alert type="error" showIcon message={submitError} />}
        </Form>
      </SectionCard>
    );
  };

  return (
    <OrganizerPage className="organizer-learner-edit">
      <PageHeader
        title="Edit Learner"
        subtitle="Name and email can be changed until the account is activated. Work unit can be changed at any time."
        back
        actions={
          <>
            <OrganizerButton onClick={() => navigate(detailPath)}>
              Cancel
            </OrganizerButton>
            <OrganizerButton
              type="primary"
              htmlType="submit"
              form="learner-edit-form"
              loading={submitting}
              disabled={loading || !detail}
            >
              Save changes
            </OrganizerButton>
          </>
        }
      />
      {renderBody()}
    </OrganizerPage>
  );
};

export default LearnerEdit;
