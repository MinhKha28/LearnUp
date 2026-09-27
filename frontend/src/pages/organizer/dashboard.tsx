import { Link } from "react-router-dom";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  ProgressLine,
  SectionCard,
  StatCard,
  WarningPanel,
} from "@/components/organizer/organizer.ui";
import "./dashboard.scss";

const Dashboard = () => (
  <OrganizerPage className="organizer-dashboard">
    <PageHeader
      title="Training overview"
      subtitle="Monitor training compliance, Course activity, subscription health, and pending Organizer work."
    />
    <div className="organizer-stat-grid organizer-dashboard-stats">
      <StatCard label="Learners" value="318" note="12 inactive" />
      <StatCard
        label="Courses in delivery"
        value="14"
        note="4 awaiting approval"
        tone="warning"
      />
      <StatCard
        label="Required completion"
        value="82%"
        note="Compliance only"
        tone="success"
      />
      <StatCard
        label="Overdue cases"
        value="23"
        note="Required only"
        tone="error"
      />
    </div>
    <div className="organizer-content-grid">
      <SectionCard title="Required training compliance">
        <div className="organizer-dashboard-progress">
          <ProgressLine label="Completed on time" count="204" value={62} />
          <ProgressLine
            label="Completed late"
            count="36"
            value={11}
            tone="amber"
          />
          <ProgressLine label="Overdue" count="23" value={7} tone="red" />
          <ProgressLine label="Exempt" count="12" value={4} tone="blue" />
        </div>
      </SectionCard>
      <SectionCard title="Action queue">
        <div className="organizer-action-queue">
          <div>
            <strong>4 Courses awaiting approval</strong>
            <span>Instructor Submitted Courses</span>
            <Link className="organizer-link" to="/organizer/courses/approvals">
              Review →
            </Link>
          </div>
          <div>
            <strong>7 content reports pending</strong>
            <span>1 near handling deadline</span>
            <Link className="organizer-link" to="/organizer/content-reports">
              Moderate →
            </Link>
          </div>
          <div>
            <strong>Subscription at 76% storage</strong>
            <span>Monitor growth &amp; limits</span>
            <Link className="organizer-link" to="/organizer/subscription">
              View →
            </Link>
          </div>
          <div>
            <strong>3 invitations expired</strong>
            <span>Instructor / Learner invites</span>
            <Link className="organizer-link" to="/organizer/instructors">
              Resend →
            </Link>
          </div>
        </div>
      </SectionCard>
    </div>
    <WarningPanel title="Subscription notice">
      Growth plan expires on 18 Dec 2026 unless plan renewal reaches the
      configured threshold. Learners with Certificates should download PDFs
      before service expiry.
    </WarningPanel>
    <div className="organizer-dashboard-actions">
      <Link to="/organizer/subscription">
        <OrganizerButton type="primary">View subscription</OrganizerButton>
      </Link>
    </div>
  </OrganizerPage>
);

export default Dashboard;
