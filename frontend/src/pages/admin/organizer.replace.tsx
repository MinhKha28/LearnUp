import { Form, Input } from "antd";
import { useNavigate } from "react-router-dom";
import { AdminButton, AdminPage, PageHeader, SectionCard, StatusTag } from "@/components/admin/admin.ui";
import "./organizer.replace.scss";

const ReplaceOrganizer = () => {
  const navigate = useNavigate();
  return (
    <AdminPage className="admin-replace-organizer">
      <PageHeader title="Replace Organizer" subtitle="Send an invitation to associate a new Organizer for Northstar Learning." actions={<AdminButton onClick={() => navigate(-1)}>Back to organization</AdminButton>} />
      <SectionCard title="Current Organizer">
        <div className="admin-current-organizer"><div><strong>Mai Nguyen</strong><span>mai.nguyen@northstar.example</span></div><StatusTag tone="success">Active</StatusTag></div>
        <p className="admin-note">The current Organizer becomes disabled only when the replacement is established.</p>
      </SectionCard>
      <SectionCard title="New Organizer invitation">
        <Form className="admin-form" layout="vertical" onFinish={() => navigate("/admin/organizations/northstar")}>
          <div className="admin-form-grid"><Form.Item label="Full name" name="name" rules={[{ required: true }]}><Input placeholder="Tran Minh Anh" /></Form.Item><Form.Item label="Email address" name="email" rules={[{ required: true, type: "email" }]}><Input placeholder="minh.anh@northstar.example" /></Form.Item></div>
          <div className="admin-replacement-note"><strong>Replacement rule</strong><p>A valid invite replaces one Organizer at a time. An email invitation will be sent to the new Organizer.</p></div>
          <div className="admin-form-actions"><AdminButton onClick={() => navigate(-1)}>Cancel</AdminButton><AdminButton type="primary" htmlType="submit">Send invitation</AdminButton></div>
        </Form>
      </SectionCard>
    </AdminPage>
  );
};
export default ReplaceOrganizer;
