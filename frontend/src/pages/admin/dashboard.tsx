import { Button } from "antd";
import { Link } from "react-router-dom";
import {
  AdminButton,
  AdminPage,
  PageHeader,
  ProgressLine,
  SectionCard,
  StatCard,
  StatusTag,
  WarningPanel,
} from "@/components/admin/admin.ui";
import "./dashboard.scss";

const Dashboard = () => (
  <AdminPage className="admin-dashboard">
    <PageHeader
      title="Platform overview"
      subtitle="Monitor organizations, subscriptions, moderation workload, and platform risks."
      actions={
        <>
          <AdminButton>Review reports</AdminButton>
          <Link to="/admin/plans/create">
            <AdminButton type="primary">Add plan</AdminButton>
          </Link>
        </>
      }
    />
    <WarningPanel title="Escalated reports require review">
      2 unresolved escalations are waiting for a platform decision.
    </WarningPanel>
    <div className="admin-stat-grid admin-dashboard-stats">
      <StatCard label="Organizations" value="24" note="Active" tone="neutral" />
      <StatCard
        label="Active subscriptions"
        value="18"
        note="Current"
        tone="success"
      />
      <StatCard
        label="Escalated reports"
        value="6"
        note="Review"
        tone="warning"
      />
      <StatCard
        label="Suspended organizations"
        value="2"
        note="Restricted"
        tone="error"
      />
    </div>
    <div className="admin-content-grid">
      <SectionCard
        title="Organizations by status"
        extra={
          <Button type="link" size="small">
            View all
          </Button>
        }
      >
        <div className="admin-dashboard-progress">
          <ProgressLine label="Active" count="18" value={75} />
          <ProgressLine
            label="Pending payment"
            count="3"
            value={38}
            tone="amber"
          />
          <ProgressLine
            label="Grace period"
            count="1"
            value={18}
            tone="amber"
          />
          <ProgressLine label="Suspended" count="2" value={28} tone="red" />
        </div>
        <p className="admin-note">
          Platform health summary
          <br />
          Most organizations are active; review grace-period and suspended
          accounts.
        </p>
      </SectionCard>
      <SectionCard
        title="Escalated reports"
        extra={
          <Link className="admin-link" to="/admin/reports">
            View all →
          </Link>
        }
      >
        <div className="admin-report-list">
          <div>
            <strong>Course content complaint</strong>
            <span>Northstar Academy</span>
            <StatusTag tone="error">3 days</StatusTag>
          </div>
          <div>
            <strong>Organizer response disputed</strong>
            <span>Apex Learning</span>
            <StatusTag tone="warning">Due tomorrow</StatusTag>
          </div>
          <div>
            <strong>Report status review</strong>
            <span>BlueRiver Institute</span>
            <StatusTag tone="warning">Overdue</StatusTag>
          </div>
        </div>
        <p className="admin-note">
          Review highlights only; reports escalated to Platform Admin.
        </p>
      </SectionCard>
    </div>
  </AdminPage>
);

export default Dashboard;
