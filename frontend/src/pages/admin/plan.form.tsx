import { Alert, App, Form, Input, InputNumber, Select } from "antd";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminButton, AdminPage, PageHeader, SectionCard, StatusTag, WarningPanel } from "@/components/admin/admin.ui";
import { createPlanAPI } from "@/services/subscription.service";
import type { IApiError } from "@/types/organization.types";
import { planErrorMessage, toCreatePlanBody, type PlanFormValues } from "@/utils/plan.view";
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
        message.success(`Plan "${res.data.name}" created and offered to new registrations.`);
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
      setSubmitError("Could not connect to the server. Please try again later.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminPage className="admin-plan-form">
      <PageHeader
        title="Create Subscription Plan"
        subtitle="Define the price, duration and the four plan limits."
        actions={
          <>
            <AdminButton onClick={() => navigate(-1)}>Cancel</AdminButton>
            <AdminButton type="primary" htmlType="submit" form="plan-form" loading={submitting}>
              Create plan
            </AdminButton>
          </>
        }
      />
      <SectionCard title="Plan details">
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
              label="Plan name"
              name="name"
              rules={[
                { required: true, whitespace: true, message: "Enter a plan name." },
                { max: 100, message: "At most 100 characters." },
              ]}
            >
              <Input placeholder="Professional" />
            </Form.Item>
            <Form.Item label="Price (VND)" name="price" rules={[{ required: true, message: "Enter a price." }]}>
              <InputNumber {...wholeNumber} min={0} placeholder="4990000" />
            </Form.Item>
            <Form.Item label="Duration (days)" name="durationDays" rules={[{ required: true, message: "Enter a duration." }]}>
              <InputNumber {...wholeNumber} min={1} max={3650} placeholder="180" />
            </Form.Item>
            <Form.Item label="Learners" name="maxLearners" rules={[{ required: true, message: "Enter a limit." }]}>
              <InputNumber {...wholeNumber} min={1} placeholder="1000" />
            </Form.Item>
            <Form.Item label="Instructors" name="maxInstructors" rules={[{ required: true, message: "Enter a limit." }]}>
              <InputNumber {...wholeNumber} min={1} placeholder="50" />
            </Form.Item>
            <Form.Item label="Courses" name="maxCourseChains" rules={[{ required: true, message: "Enter a limit." }]}>
              <InputNumber {...wholeNumber} min={1} placeholder="100" />
            </Form.Item>
            <Form.Item label="Storage (GB)" name="storageGb" rules={[{ required: true, message: "Enter a storage limit." }]}>
              <InputNumber min={0.1} step={1} precision={1} style={{ width: "100%" }} placeholder="250" />
            </Form.Item>
          </div>
          <div className="admin-plan-form-note">
            <strong>Plan behavior</strong>
            <p>
              A new plan is offered to new registrations right away. Courses are counted per version chain.
              Organizations keep the limits captured at activation until their current term ends.
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
      <PageHeader title="Edit Growth Plan" subtitle="Changes apply to future registrations and renewals only." actions={<><AdminButton>Discontinue plan</AdminButton><AdminButton onClick={() => navigate(-1)}>Cancel</AdminButton><AdminButton type="primary" htmlType="submit" form="plan-form">Save changes</AdminButton></>} />
      <SectionCard title={<>Current configuration <StatusTag tone="success">Available</StatusTag></>}>
        <Form id="plan-form" className="admin-form" layout="vertical" initialValues={initialValues} onFinish={() => navigate("/admin/plans")}>
          <div className="admin-form-grid"><Form.Item label="Plan name" name="name" rules={[{ required: true }]}><Input placeholder="Professional" /></Form.Item><Form.Item label="Duration" name="duration" rules={[{ required: true }]}><Select placeholder="Select duration" options={[3,6,12].map((value) => ({ value, label: `${value} months` }))} /></Form.Item><Form.Item label="Learners" name="learners" rules={[{ required: true }]}><InputNumber min={1} placeholder="1,000" /></Form.Item><Form.Item label="Instructors" name="instructors" rules={[{ required: true }]}><InputNumber min={1} placeholder="50" /></Form.Item><Form.Item label="Courses" name="courses" rules={[{ required: true }]}><InputNumber min={1} placeholder="100" /></Form.Item><Form.Item label="Storage (GB)" name="storage" rules={[{ required: true }]}><InputNumber min={1} placeholder="250" /></Form.Item></div>
        </Form>
      </SectionCard>
      <WarningPanel title="Important">Existing Organizations keep their current captured limits until the end of their active term. If this Plan is discontinued, it disappears from future selection lists and no longer accepts Organizations.</WarningPanel>
    </AdminPage>
  );
};

const PlanForm = ({ mode }: { mode: "create" | "edit" }) =>
  mode === "edit" ? <PlanEditPreview /> : <PlanCreate />;

export default PlanForm;
