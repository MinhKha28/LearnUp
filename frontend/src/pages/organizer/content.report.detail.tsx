import { Form, Input, Select } from "antd";
import { useNavigate } from "react-router-dom";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
} from "@/components/organizer/organizer.ui";
import "./content.report.detail.scss";

const ContentReportDetail = () => {
  const navigate = useNavigate();
  return (
    <OrganizerPage className="organizer-content-report-detail">
      <PageHeader
        title="Report REP-220"
        subtitle="Reading: Locked steps • Pending"
        back
        actions={<OrganizerButton danger>Escalate</OrganizerButton>}
      />
      <div className="organizer-content-grid">
        <SectionCard title="Reported content">
          <div className="organizer-detail-grid">
            <div className="organizer-detail-item">
              <span>Course</span>
              <strong>Workplace Safety Essentials</strong>
            </div>
            <div className="organizer-detail-item">
              <span>Reason</span>
              <strong>Unsafe operational instruction is alleged</strong>
            </div>
            <div className="organizer-detail-item">
              <span>Content owner</span>
              <strong>An Tran</strong>
            </div>
            <div className="organizer-detail-item">
              <span>Handling deadline</span>
              <strong>8 hours remaining</strong>
            </div>
          </div>
        </SectionCard>
        <SectionCard title="Decision history">
          <div className="organizer-decision-history">
            <div>
              <span>21 Sep 2026, 09:14</span>
              <strong>Report submitted</strong>
            </div>
            <p className="organizer-note">No decision yet.</p>
          </div>
        </SectionCard>
      </div>
      <SectionCard title="Organizer decision" className="organizer-decision-card">
        <Form
          className="organizer-form"
          layout="vertical"
          onFinish={() => navigate("/organizer/content-reports")}
        >
          <div className="organizer-form-grid">
            <Form.Item label="Decision" name="decision" rules={[{ required: true }]}>
              <Select
                placeholder="Confirm violation"
                options={[
                  { value: "violation", label: "Confirm violation" },
                  { value: "no-violation", label: "No violation" },
                ]}
              />
            </Form.Item>
            <Form.Item label="Severity" name="severity" rules={[{ required: true }]}>
              <Select
                placeholder="Minor"
                options={[
                  { value: "minor", label: "Minor" },
                  { value: "serious", label: "Serious" },
                ]}
              />
            </Form.Item>
          </div>
          <Form.Item label="Reason / corrective instruction" name="reason">
            <Input.TextArea
              rows={4}
              placeholder="Provide a clear reason that will be sent to reporter and content owner."
            />
          </Form.Item>
          <div className="organizer-form-actions">
            <OrganizerButton>Dismiss report</OrganizerButton>
            <OrganizerButton type="primary" htmlType="submit">
              Resolve report
            </OrganizerButton>
          </div>
        </Form>
      </SectionCard>
    </OrganizerPage>
  );
};

export default ContentReportDetail;
