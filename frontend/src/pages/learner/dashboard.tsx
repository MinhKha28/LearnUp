import { useNavigate } from "react-router-dom";
import {
  CourseListItem,
  LearnerButton,
  LearnerPage,
  PageHeader,
  SectionCard,
  StatusTag,
  WarningPanel,
} from "@/components/learner/learner.ui";
import "./dashboard.scss";

const requiredTraining = [
  {
    title: "Workplace Safety Essentials",
    pills: [
      { label: "Required", tone: "warning" as const },
      { label: "Overdue", tone: "error" as const },
    ],
    meta: "Due 23 Sep 2026",
    progress: 65,
    to: "/learner/courses/workplace-safety",
  },
  {
    title: "Operational Procedures",
    pills: [
      { label: "Required", tone: "warning" as const },
      { label: "In Progress", tone: "neutral" as const },
    ],
    meta: "Due 30 Sep 2026",
    progress: 32,
    to: "/learner/courses/operational-procedures",
  },
];

const Dashboard = () => {
  const navigate = useNavigate();

  return (
    <LearnerPage className="learner-dashboard">
      <PageHeader
        eyebrow="LEARNER"
        title="Your learning, at a glance"
        subtitle="Required training comes first. Continue where you left off."
      />
      <WarningPanel title="Required course overdue">
        You can still continue and complete this Course.
      </WarningPanel>
      <h2 className="learner-dashboard-section-title">Required training</h2>
      <div className="learner-course-list learner-dashboard-required">
        {requiredTraining.map((course) => (
          <CourseListItem
            key={course.title}
            title={course.title}
            pills={course.pills}
            meta={course.meta}
            progress={course.progress}
            to={course.to}
          />
        ))}
      </div>
      <h2 className="learner-dashboard-section-title">Up next</h2>
      <div className="learner-dashboard-upnext-grid">
        <SectionCard className="learner-upnext-card">
          <h3>Peer review tasks</h3>
          <p>Assigned reviews awaiting your feedback</p>
          <div className="learner-upnext-footer">
            <StatusTag tone="warning">2 pending</StatusTag>
            <LearnerButton onClick={() => navigate("/learner/peer-review")}>
              View tasks
            </LearnerButton>
          </div>
        </SectionCard>
        <SectionCard className="learner-upnext-card">
          <h3>Your certificates</h3>
          <p>Keep a copy of issued Certificates.</p>
          <div className="learner-upnext-footer">
            <span />
            <LearnerButton onClick={() => navigate("/learner/certificates")}>
              View all
            </LearnerButton>
          </div>
        </SectionCard>
      </div>
    </LearnerPage>
  );
};

export default Dashboard;
