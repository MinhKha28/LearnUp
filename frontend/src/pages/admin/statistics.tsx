import { AdminPage, PageHeader, ProgressLine, SectionCard, StatCard } from "@/components/admin/admin.ui";
import "./statistics.scss";

const Statistics = () => <AdminPage className="admin-statistics">
  <PageHeader title="Platform Statistics" subtitle="Platform-wide operational statistics defined in the Admin scope." />
  <div className="admin-stat-grid admin-statistics-kpis"><StatCard label="Total organizations" value="24" note="All active" /><StatCard label="Subscriptions expiring soon" value="4" note="Next 30 days" tone="warning" /><StatCard label="Escalated reports" value="6" note="Require review" tone="warning" /><StatCard label="Suspended organizations" value="2" note="Platform level" tone="error" /></div>
  <div className="admin-statistics-grid"><SectionCard title="Organizations by status"><div className="admin-stack"><ProgressLine label="Active" count="18" value={75} /><ProgressLine label="Pending payment" count="3" value={38} tone="amber" /><ProgressLine label="Grace period" count="1" value={18} tone="amber" /><ProgressLine label="Suspended" count="2" value={26} tone="red" /></div></SectionCard><SectionCard title="Organizations by Plan"><div className="admin-stack"><ProgressLine label="Starter" count="5" value={30} /><ProgressLine label="Growth" count="12" value={70} /><ProgressLine label="Enterprise" count="7" value={42} tone="blue" /></div></SectionCard></div>
  <SectionCard title="Report handling"><div className="admin-report-metrics"><div><strong>6</strong><span>New escalated</span></div><div><strong>31</strong><span>Resolved this month</span></div><div><strong>14</strong><span>Within deadline</span></div><div><strong className="admin-error-text">2</strong><span>Overdue</span></div></div><p className="admin-note">This page intentionally avoids advanced analytics outside the MVP. It shows only statistics defined in scope.</p></SectionCard>
</AdminPage>;
export default Statistics;
