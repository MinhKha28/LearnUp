import { Link } from "react-router-dom";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
  StatusTag,
} from "@/components/organizer/organizer.ui";
import "./subscription.scss";

const usage = [
  { label: "Learners", used: 318, total: 500, unit: "" },
  { label: "Instructors", used: 18, total: 25, unit: "" },
  { label: "Courses", used: 32, total: 50, unit: "" },
  { label: "Storage", used: 91, total: 120, unit: " GB" },
];

const Subscription = () => (
  <OrganizerPage className="organizer-subscription">
    <PageHeader
      title="Subscription"
      subtitle="Review current plan, allocation status, expiry, and all four usage limits."
      actions={
        <>
          <Link to="/organizer/subscription/renew">
            <OrganizerButton>Renew</OrganizerButton>
          </Link>
          <Link to="/organizer/subscription/upgrade">
            <OrganizerButton type="primary">Upgrade</OrganizerButton>
          </Link>
        </>
      }
    />
    <SectionCard
      title="Growth Plan"
      extra={<StatusTag tone="success">Current</StatusTag>}
    >
      <div className="organizer-metric-row">
        <div className="organizer-metric">
          <span>Expires</span>
          <strong>18 Dec 2026</strong>
        </div>
        <div className="organizer-metric">
          <span>Access state</span>
          <strong>Full access</strong>
        </div>
        <div className="organizer-metric">
          <span>Grace period</span>
          <strong>7 days after expiry</strong>
        </div>
      </div>
    </SectionCard>
    <SectionCard title="Plan usage">
      <p className="organizer-note">
        Warnings appear when a limit reaches the platform threshold.
      </p>
      <div className="organizer-usage-grid">
        {usage.map((item) => (
          <div className="organizer-usage-row" key={item.label}>
            <div>
              <span>{item.label}</span>
            </div>
            <strong>
              {item.used} / {item.total}
              {item.unit}
            </strong>
            <div className="organizer-usage">
              <span
                style={{ width: `${(item.used / item.total) * 100}%` }}
              />
            </div>
            <small>{Math.floor((item.used / item.total) * 100)}% used</small>
          </div>
        ))}
      </div>
      <div className="organizer-subscription-usage-note">
        Downgrade is not supported. Upgrade must cover current usage across
        all four limits.
      </div>
    </SectionCard>
    <SectionCard title="Lifecycle rules">
      <p className="organizer-note">
        After expiry: 7-day access grace period. During grace, Learners can
        continue existing Enrollments but no new Enrollments are created.
        <br />
        After grace: Subscription becomes Suspended. Data is retained for 30
        days; Organizer can still export training reports.
      </p>
    </SectionCard>
  </OrganizerPage>
);

export default Subscription;
