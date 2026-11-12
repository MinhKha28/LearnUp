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
      message.info("Không có thay đổi để lưu.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await updateLearnerAPI(learnerId, body);
      if (res.data?.id) {
        message.success(
          res.data.invitationResent
            ? `Đã cập nhật thông tin Học viên. Lời mời mới sẽ được gửi đến ${res.data.email}.`
            : "Đã cập nhật thông tin Học viên.",
        );
        navigate(detailPath);
      } else {
        showUpdateError(
          Number(res.statusCode),
          (res as unknown as { error?: IApiError }).error,
        );
      }
    } catch {
      setSubmitError("Không kết nối được với máy chủ. Vui lòng thử lại sau.");
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
            errors: ["Email này đã được tài khoản khác sử dụng."],
          },
        ]);
        return;
      case "ACCOUNT_ALREADY_ACTIVATED":
        setSubmitError(
          "Tài khoản vừa được kích hoạt. Tên và email hiện do Học viên quản lý.",
        );
        setReloadKey((key) => key + 1);
        return;
      case "CONCURRENT_UPDATE":
        setSubmitError(
          "Thông tin Học viên vừa được cập nhật. Vui lòng tải lại và thử lại.",
        );
        setReloadKey((key) => key + 1);
        return;
      case "LEARNER_NOT_FOUND":
        setDetail(null);
        setLoadError("notFound");
        return;
      case "ORGANIZATION_NOT_ACTIVE":
        setSubmitError(
          "Tổ chức đang bị tạm ngưng. Không thể cập nhật thông tin Học viên.",
        );
        return;
      case "SUBSCRIPTION_NOT_ACTIVE":
        setSubmitError(
          "Gói dịch vụ chưa hoạt động. Không thể cập nhật thông tin Học viên.",
        );
        return;
      case "FORBIDDEN":
        setSubmitError("Bạn không có quyền cập nhật thông tin Học viên.");
        return;
      default:
        setSubmitError(
          status >= 500
            ? "Đã xảy ra lỗi. Vui lòng thử lại sau."
            : "Một số thông tin chưa hợp lệ. Vui lòng kiểm tra và thử lại.",
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
          message="Không tìm thấy Học viên"
          description="Học viên này không tồn tại hoặc không còn thuộc tổ chức của bạn."
          action={
            <Link to="/organizer/learners">
              <Button>Quay lại</Button>
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
          message="Không thể tải thông tin Học viên."
          description="Vui lòng kiểm tra kết nối và thử lại."
          action={
            <Button onClick={() => setReloadKey((key) => key + 1)}>
              Thử lại
            </Button>
          }
        />
      );
    }

    const lockedHint = activated
      ? "Do Học viên quản lý sau khi kích hoạt."
      : undefined;
    return (
      <SectionCard title="Thông tin Học viên">
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
              message="Tài khoản đã được kích hoạt. Học viên tự quản lý tên và địa chỉ email đăng nhập được giữ cố định. Bạn vẫn có thể cập nhật đơn vị công tác."
            />
          )}
          <div className="organizer-form-grid">
            <Form.Item
              label="Họ và tên"
              name="fullName"
              extra={lockedHint}
              rules={[
                {
                  required: true,
                  whitespace: true,
                  message: "Nhập họ và tên.",
                },
                { validator: textRule("Họ và tên", 100) },
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
                { required: true, message: "Nhập địa chỉ email." },
                { type: "email", message: "Nhập địa chỉ email hợp lệ." },
                { max: 254, message: "Email có tối đa 254 ký tự." },
              ]}
            >
              <Input maxLength={254} autoComplete="off" disabled={activated} />
            </Form.Item>
            <Form.Item
              label="Đơn vị công tác (Không bắt buộc)"
              name="department"
              rules={[{ validator: textRule("Đơn vị công tác", 100) }]}
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
                <Input placeholder="Kỹ thuật" maxLength={100} />
              </AutoComplete>
            </Form.Item>
          </div>
          {/* BR-35: đổi email làm lời mời cũ mất hiệu lực */}
          {emailChanged &&
            (detail.status === "Pending" ? (
              <Alert
                type="warning"
                showIcon
                message="Khi đổi email, liên kết mời hiện tại sẽ hết hiệu lực và lời mời mới sẽ được gửi đến địa chỉ mới."
              />
            ) : (
              <Alert
                type="warning"
                showIcon
                message="Khi đổi email, liên kết mời hiện tại sẽ hết hiệu lực. Hệ thống chỉ gửi lời mời mới khi tài khoản hoạt động."
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
        title="Chỉnh sửa Học viên"
        subtitle="Bạn có thể đổi tên và email trước khi tài khoản được kích hoạt, và cập nhật đơn vị công tác bất cứ lúc nào."
        back
        actions={
          <>
            <OrganizerButton onClick={() => navigate(detailPath)}>
              Hủy
            </OrganizerButton>
            <OrganizerButton
              type="primary"
              htmlType="submit"
              form="learner-edit-form"
              loading={submitting}
              disabled={loading || !detail}
            >
              Lưu thay đổi
            </OrganizerButton>
          </>
        }
      />
      {renderBody()}
    </OrganizerPage>
  );
};

export default LearnerEdit;
