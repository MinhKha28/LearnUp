import { Form, Input, InputNumber, Select } from "antd";
import { useNavigate } from "react-router-dom";
import { AdminButton, AdminPage, PageHeader, SectionCard, StatusTag, WarningPanel } from "@/components/admin/admin.ui";
import "./plan.form.scss";

const PlanForm = ({ mode }: { mode: "create" | "edit" }) => {
  const navigate = useNavigate();
  const editing = mode === "edit";
  const initialValues = editing ? { name: "Growth", duration: 6, learners: 500, instructors: 25, courses: 50, storage: 120 } : undefined;
  return (
    <AdminPage className="admin-plan-form">
      <PageHeader title={editing ? "Edit Growth Plan" : "Create Subscription Plan"} subtitle={editing ? "Changes apply to future registrations and renewals only." : "Define duration and the four plan limits."} actions={<>{editing && <AdminButton>Discontinue plan</AdminButton>}<AdminButton onClick={() => navigate(-1)}>Cancel</AdminButton><AdminButton type="primary" htmlType="submit" form="plan-form">{editing ? "Save changes" : "Create plan"}</AdminButton></>} />
      <SectionCard title={editing ? <>Current configuration <StatusTag tone="success">Available</StatusTag></> : "Plan details"}>
        <Form id="plan-form" className="admin-form" layout="vertical" initialValues={initialValues} onFinish={() => navigate("/admin/plans")}>
          <div className="admin-form-grid"><Form.Item label="Plan name" name="name" rules={[{ required: true }]}><Input placeholder="Professional" /></Form.Item><Form.Item label="Duration" name="duration" rules={[{ required: true }]}><Select placeholder="Select duration" options={[3,6,12].map((value) => ({ value, label: `${value} months` }))} /></Form.Item><Form.Item label="Learners" name="learners" rules={[{ required: true }]}><InputNumber min={1} placeholder="1,000" /></Form.Item><Form.Item label="Instructors" name="instructors" rules={[{ required: true }]}><InputNumber min={1} placeholder="50" /></Form.Item><Form.Item label="Courses" name="courses" rules={[{ required: true }]}><InputNumber min={1} placeholder="100" /></Form.Item><Form.Item label="Storage (GB)" name="storage" rules={[{ required: true }]}><InputNumber min={1} placeholder="250" /></Form.Item></div>
          {!editing && <div className="admin-plan-form-note"><strong>Plan behavior</strong><p>A Plan defines usage limits only. Organizations-specific usage is tracked by its Subscription. Discontinuing a Plan does not stop service; it prevents new registrations and future renewals.</p></div>}
        </Form>
      </SectionCard>
      {editing && <WarningPanel title="Important">Existing Organizations keep their current captured limits until the end of their active term. If this Plan is discontinued, it disappears from future selection lists and no longer accepts Organizations.</WarningPanel>}
    </AdminPage>
  );
};
export default PlanForm;
