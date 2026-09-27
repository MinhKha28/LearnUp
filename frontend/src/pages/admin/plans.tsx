import { Link } from "react-router-dom";
import { AdminButton, AdminPage, PageHeader, SectionCard, StatusTag, WarningPanel } from "@/components/admin/admin.ui";
import "./plans.scss";

const planData = [
  { name: "Starter", description: "5 Organizations currently using", duration: "3 months", learners: "100", instructors: "10", courses: "15", storage: "50 GB" },
  { name: "Growth", description: "11 Organizations currently using", duration: "6 months", learners: "500", instructors: "25", courses: "50", storage: "120 GB" },
  { name: "Enterprise", description: "7 Organizations currently using", duration: "12 months", learners: "1,000", instructors: "100", courses: "200", storage: "500 GB" },
];
const Plans = () => (
  <AdminPage className="admin-plans">
    <PageHeader title="Subscription Plans" subtitle="Manage the plans offered to new registrations and future renewals." actions={<Link to="create"><AdminButton type="primary">Create plan</AdminButton></Link>} />
    <div className="admin-plan-grid">
      {planData.map((plan) => <SectionCard key={plan.name} className="admin-plan-card" title={plan.name} extra={<StatusTag tone="success">Available</StatusTag>}>
        <p>{plan.description}</p>
        <dl><div><dt>Duration</dt><dd>{plan.duration}</dd></div><div><dt>Learners</dt><dd>{plan.learners}</dd></div><div><dt>Instructors</dt><dd>{plan.instructors}</dd></div><div><dt>Courses</dt><dd>{plan.courses}</dd></div><div><dt>Storage</dt><dd>{plan.storage}</dd></div></dl>
        <div className="admin-plan-actions"><Link to={`${plan.name.toLowerCase()}/edit`}><AdminButton>Edit plan</AdminButton></Link><button className="admin-link">View details</button></div>
      </SectionCard>)}
    </div>
    <WarningPanel title="Plan changes affect future activity only">Editing a Plan applies to new registrations and renewals made afterward. Organizations already using the Plan keep the limits captured at activation until the current term ends.</WarningPanel>
  </AdminPage>
);
export default Plans;
