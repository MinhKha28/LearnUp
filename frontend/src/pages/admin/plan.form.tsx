import { Alert, App, Form, Input, InputNumber, Select } from "antd";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminButton, AdminPage, PageHeader, SectionCard, StatusTag, WarningPanel } from "@/components/admin/admin.ui";
import { createPlanAPI } from "@/services/subscription.service";
import type { IApiError } from "@/types/organization.types";
import { PLAN_LIMITS, planErrorMessage, toCreatePlanBody, type PlanFormValues } from "@/utils/plan.view";
import "./plan.form.scss";

const wholeNumber = { precision: 0, style: { width: "100%" } } as const;

const PlanCreate = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [form] = Form.useForm<PlanFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submit = async (values: PlanFormValues) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await createPlanAPI(toCreatePlanBody(values));
      if (res.data?.id) {
        message.success(`Đã tạo gói "${res.data.name}" và cung cấp cho lượt đăng ký mới.`);
        navigate("/admin/plans");
        return;
      }
      const code = (res as unknown as { error?: IApiError }).error?.code;
      if (code === "PLAN_NAME_TAKEN") {
        form.setFields([{ name: "name", errors: [planErrorMessage(409, code)] }]);
      } else {
        setSubmitError(planErrorMessage(Number(res.statusCode), code));
      }
    } catch {
      setSubmitError("Không kết nối được với máy chủ. Vui lòng thử lại sau.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminPage className="admin-plan-form">
      <PageHeader
        title="Tạo gói"
        subtitle="Đặt giá, thời hạn và bốn giới hạn của gói."
        actions={
          <>
            <AdminButton onClick={() => navigate(-1)}>Hủy</AdminButton>
            <AdminButton type="primary" htmlType="submit" form="plan-form" loading={submitting}>
              Tạo gói
            </AdminButton>
          </>
        }
      />
      <SectionCard title="Thông tin gói">
        {submitError && <Alert type="error" showIcon message={submitError} role="alert" />}
        <Form<PlanFormValues>
          id="plan-form"
          form={form}
          className="admin-form"
          layout="vertical"
          requiredMark={false}
          disabled={submitting}
          onFinish={submit}
        >
          <div className="admin-form-grid">
            <Form.Item
              label="Tên gói"
              name="name"
              rules={[
                { required: true, whitespace: true, message: "Hãy nhập tên gói." },
                { max: 100, message: "Tối đa 100 ký tự." },
              ]}
            >
              <Input placeholder="Professional" />
            </Form.Item>
            <Form.Item label="Giá (VND)" name="price" rules={[{ required: true, message: "Hãy nhập giá." }]}>
              <InputNumber {...wholeNumber} min={0} max={PLAN_LIMITS.price} placeholder="4990000" />
            </Form.Item>
            <Form.Item label="Thời hạn (ngày)" name="durationDays" rules={[{ required: true, message: "Hãy nhập thời hạn." }]}>
              <InputNumber {...wholeNumber} min={1} max={PLAN_LIMITS.durationDays} placeholder="180" />
            </Form.Item>
            <Form.Item label="Số học viên" name="maxLearners" rules={[{ required: true, message: "Hãy nhập giới hạn." }]}>
              <InputNumber {...wholeNumber} min={1} max={PLAN_LIMITS.maxLearners} placeholder="1000" />
            </Form.Item>
            <Form.Item label="Số giảng viên" name="maxInstructors" rules={[{ required: true, message: "Hãy nhập giới hạn." }]}>
              <InputNumber {...wholeNumber} min={1} max={PLAN_LIMITS.maxInstructors} placeholder="50" />
            </Form.Item>
            <Form.Item label="Số khóa học" name="maxCourseChains" rules={[{ required: true, message: "Hãy nhập giới hạn." }]}>
              <InputNumber {...wholeNumber} min={1} max={PLAN_LIMITS.maxCourseChains} placeholder="100" />
            </Form.Item>
            <Form.Item label="Dung lượng lưu trữ (GB)" name="storageGb" rules={[{ required: true, message: "Hãy nhập giới hạn dung lượng." }]}>
              <InputNumber min={PLAN_LIMITS.minStorageGb} max={PLAN_LIMITS.maxStorageGb} step={1} precision={1} style={{ width: "100%" }} placeholder="250" />
            </Form.Item>
          </div>
          <div className="admin-plan-form-note">
            <strong>Cách gói hoạt động</strong>
            <p>
              Gói mới được cung cấp ngay cho lượt đăng ký mới. Khóa học được đếm theo chuỗi phiên bản.
              Tổ chức giữ nguyên giới hạn đã chốt lúc kích hoạt cho tới hết kỳ hiện tại.
            </p>
          </div>
        </Form>
      </SectionCard>
    </AdminPage>
  );
};

const PlanEditPreview = () => {
  const navigate = useNavigate();
  const initialValues = { name: "Growth", duration: 6, learners: 500, instructors: 25, courses: 50, storage: 120 };
  return (
    <AdminPage className="admin-plan-form">
      <PageHeader title="Sửa gói (xem trước)" subtitle="Chưa sửa được gói (UC43.2). Trang xem trước này dùng dữ liệu mẫu và không lưu gì." actions={<><AdminButton disabled>Ngừng cung cấp gói</AdminButton><AdminButton onClick={() => navigate(-1)}>Quay lại</AdminButton><AdminButton type="primary" disabled>Lưu thay đổi</AdminButton></>} />
      <SectionCard title={<>Cấu hình hiện tại <StatusTag tone="success">Đang cung cấp</StatusTag></>}>
        <Form className="admin-form" layout="vertical" initialValues={initialValues} disabled>
          <div className="admin-form-grid"><Form.Item label="Tên gói" name="name" rules={[{ required: true }]}><Input placeholder="Professional" /></Form.Item><Form.Item label="Thời hạn" name="duration" rules={[{ required: true }]}><Select placeholder="Chọn thời hạn" options={[3,6,12].map((value) => ({ value, label: `${value} tháng` }))} /></Form.Item><Form.Item label="Số học viên" name="learners" rules={[{ required: true }]}><InputNumber min={1} placeholder="1.000" /></Form.Item><Form.Item label="Số giảng viên" name="instructors" rules={[{ required: true }]}><InputNumber min={1} placeholder="50" /></Form.Item><Form.Item label="Số khóa học" name="courses" rules={[{ required: true }]}><InputNumber min={1} placeholder="100" /></Form.Item><Form.Item label="Dung lượng lưu trữ (GB)" name="storage" rules={[{ required: true }]}><InputNumber min={1} placeholder="250" /></Form.Item></div>
        </Form>
      </SectionCard>
      <WarningPanel title="Lưu ý">Tổ chức đang dùng gói giữ nguyên giới hạn đã chốt cho tới hết kỳ hiện tại. Nếu gói này ngừng cung cấp, gói sẽ không còn trong danh sách lựa chọn và không nhận thêm tổ chức mới.</WarningPanel>
    </AdminPage>
  );
};

const PlanForm = ({ mode }: { mode: "create" | "edit" }) =>
  mode === "edit" ? <PlanEditPreview /> : <PlanCreate />;

export default PlanForm;
