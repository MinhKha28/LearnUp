import { Form, Input, Select } from "antd";
import { useNavigate } from "react-router-dom";
import { AdminButton, AdminPage, DetailItem, PageHeader, SectionCard, StatusTag } from "@/components/admin/admin.ui";
import "./report.detail.scss";

const ReportDetail = () => {
  const navigate = useNavigate();
  return <AdminPage className="admin-report-detail">
    <PageHeader title="Report REP-1042" subtitle="Escalated report · Northstar Learning" actions={<><StatusTag tone="warning">Escalated</StatusTag><AdminButton onClick={() => navigate(-1)}>Back to queue</AdminButton></>} />
    <div className="admin-content-grid">
      <SectionCard title="Reported content"><div className="admin-report-copy"><span>Course</span><strong>Workplace Safety Essentials</strong><span>Reported item</span><strong>Lesson 4 / Reading resource</strong><span>Reporter reason</span><p>Content is alleged to contain unsafe operational guidance.</p><span>Escalation source</span><p>Reporter requested escalation after Organizer decision.</p></div></SectionCard>
      <SectionCard title="Organization context"><div className="admin-stack"><DetailItem label="Organization">Northstar Learning</DetailItem><DetailItem label="Instructor">An Tran</DetailItem><DetailItem label="Previous Organizer decision">No violation</DetailItem><DetailItem label="Escalated at">21 Sep 2026, 09:30</DetailItem></div></SectionCard>
    </div>
    <SectionCard title="Final platform decision" className="admin-decision-card"><Form className="admin-form" layout="vertical" onFinish={() => navigate("/admin/reports")}><Form.Item label="Decision" name="decision" rules={[{ required: true }]}><Select placeholder="Confirm violation" options={[{ value: "violation", label: "Confirm violation" },{ value: "no-violation", label: "No violation" }]} /></Form.Item><Form.Item label="Internal decision note" name="note"><Input.TextArea rows={4} placeholder="Explain the final decision and affected content." /></Form.Item><div className="admin-form-actions"><AdminButton>Dismiss report</AdminButton><AdminButton type="primary" htmlType="submit">Resolve & disable content</AdminButton></div></Form></SectionCard>
    <p className="admin-note admin-report-footer">When resolved, LearnUP notifies the reporter and the instructor who owns the content. A single Organization violation does not automatically suspend the whole Organization.</p>
  </AdminPage>;
};
export default ReportDetail;
