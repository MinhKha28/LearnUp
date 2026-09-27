import { Form, Input, Modal } from "antd";
import { useState } from "react";
import { Link } from "react-router-dom";
import { AdminButton, AdminPage, DetailItem, PageHeader, SectionCard, StatusTag } from "@/components/admin/admin.ui";
import "./organization.detail.scss";

const OrganizationDetail = () => {
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspended, setSuspended] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <AdminPage className="admin-organization-detail">
      <PageHeader
        title="Northstar Learning"
        subtitle="Organization detail · ORG-024"
        actions={<><Link to="replace-organizer"><AdminButton>Replace Organizer</AdminButton></Link><AdminButton danger onClick={() => setSuspendOpen(true)}>{suspended ? "Suspended" : "Suspend"}</AdminButton></>}
      />
      <div className="admin-content-grid">
        <div className="admin-stack">
          <SectionCard title="Organization information">
            <div className="admin-detail-grid">
              <DetailItem label="Legal name">Northstar Learning Co., Ltd.</DetailItem>
              <DetailItem label="Contact">training@northstar.example</DetailItem>
              <DetailItem label="Tax code">1801234567</DetailItem>
              <DetailItem label="Telephone">+84 901 234 567</DetailItem>
            </div>
          </SectionCard>
          <SectionCard title="Subscription & usage" extra={<StatusTag tone="info">Current</StatusTag>}>
            <div className="admin-metric-row">
              <div className="admin-metric"><span>Plan</span><strong>Growth</strong><small>Current plan</small></div>
              <div className="admin-metric"><span>Expires</span><strong>18 Dec 2026</strong><small>Renewal date</small></div>
              <div className="admin-metric"><span>Learners</span><strong>84 / 200</strong><div className="admin-usage"><span style={{ width: "42%" }} /></div></div>
              <div className="admin-metric"><span>Courses</span><strong>24 / 50</strong><div className="admin-usage"><span style={{ width: "48%" }} /></div></div>
            </div>
          </SectionCard>
        </div>
        <SectionCard title="Current Organizer">
          <div className="admin-organizer-card"><strong>Mai Nguyen</strong><span>mai.nguyen@northstar.example</span><StatusTag tone="success">Active</StatusTag></div>
          <p className="admin-note">One active Organizer per Organization.</p>
        </SectionCard>
      </div>
      <SectionCard title="Sanction history" className="admin-sanction-card">
        <div className="admin-sanction-row admin-sanction-head"><span>Date</span><span>Action</span><span>Reason</span><span>Status</span></div>
        <div className="admin-sanction-row"><span>02 Aug 2026</span><strong>Warning issued</strong><span>Repeated report handling delays</span><StatusTag tone="neutral">Closed</StatusTag></div>
        <div className="admin-sanction-row"><span>14 Jun 2026</span><strong>No suspension</strong><span>System-wide violation review</span><StatusTag tone="success">Resolved</StatusTag></div>
      </SectionCard>
      <Modal className="admin-suspend-modal" open={suspendOpen} centered title="Suspend Organization" onCancel={() => setSuspendOpen(false)} footer={<><AdminButton onClick={() => setSuspendOpen(false)}>Cancel</AdminButton><AdminButton danger type="primary" disabled={!reason.trim()} onClick={() => { setSuspended(true); setSuspendOpen(false); }}>Suspend organization</AdminButton></>}>
        <p>You are issuing an immediate suspension to Northstar Learning.</p>
        <div className="admin-modal-warning"><strong>Business rule impact</strong><span>Suspension blocks Organization access. Active courses and enrollments remain visible to the investigation team.</span></div>
        <Form layout="vertical" className="admin-form"><Form.Item label="Reason" required><Input.TextArea rows={4} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="System-wide violation or repeated overdue report handling" /></Form.Item></Form>
        <p className="admin-note">This action is for organization-level violations and is logged for audit.</p>
      </Modal>
    </AdminPage>
  );
};

export default OrganizationDetail;
