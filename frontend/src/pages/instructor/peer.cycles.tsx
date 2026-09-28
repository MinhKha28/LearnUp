import { useNavigate } from "react-router-dom";
import { instructorPeerCycles } from "@/components/instructor/instructor.data";
import { InfoPanel, InstructorPage, PageHeader } from "@/components/instructor/instructor.ui";
import "./peer.cycles.scss";

const PeerCycles = () => {
  const navigate = useNavigate();

  return (
    <InstructorPage className="instructor-peer-cycles">
      <PageHeader
        eyebrow="INSTRUCTOR"
        title="Peer Review Cycles"
        subtitle="Safety Assignment / Periodic submission and review cycles."
      />
      <div className="instructor-cycles-table">
        <div className="instructor-cycles-row instructor-cycles-head">
          <span>Cycle</span>
          <span>Opened</span>
          <span>Closed &amp; assigned</span>
          <span>Review deadline</span>
          <span>Submissions</span>
          <span>Status</span>
        </div>
        {instructorPeerCycles.map((cycle) => (
          <div
            className="instructor-cycles-row instructor-cycles-row-clickable"
            key={cycle.id}
            onClick={() => navigate(`/instructor/peer-cycles/${cycle.id}`)}
          >
            <strong>{cycle.label}</strong>
            <span>{cycle.openedLabel}</span>
            <span>{cycle.closedLabel}</span>
            <span>{cycle.reviewDeadlineLabel}</span>
            <span>{cycle.submissionsCountLabel}</span>
            <span>{cycle.status}</span>
          </div>
        ))}
      </div>
      <InfoPanel title="Cycle rule">
        New cycle opens on schedule; review deadline starts from close and assignment.
      </InfoPanel>
    </InstructorPage>
  );
};

export default PeerCycles;
