import { useNavigate, useParams } from "react-router-dom";
import { findPeerCycle } from "@/components/instructor/instructor.data";
import {
  DetailItem,
  InstructorButton,
  InstructorPage,
  PageHeader,
  SectionCard,
  WarningPanel,
} from "@/components/instructor/instructor.ui";
import "./peer.cycles.scss";

const PeerCycleDetail = () => {
  const { cycleId } = useParams();
  const navigate = useNavigate();
  const cycle = findPeerCycle(cycleId);

  if (!cycle) {
    return (
      <InstructorPage className="instructor-peer-cycles">
        <PageHeader
          eyebrow="PEER CYCLES / DETAIL"
          title="Cycle not found"
          subtitle="This Peer Review Cycle may have been removed."
          back
        />
        <InstructorButton onClick={() => navigate("/instructor/peer-cycles")}>
          Back to Peer Cycles
        </InstructorButton>
      </InstructorPage>
    );
  }

  return (
    <InstructorPage className="instructor-peer-cycles">
      <PageHeader
        eyebrow="PEER CYCLES / DETAIL"
        title="Peer Review Cycle Details"
        subtitle={`${cycle.label} / ${cycle.assignmentTitle}`}
        back
      />
      <SectionCard className="instructor-cycle-meta-card">
        <div className="instructor-cycle-meta-grid">
          <DetailItem label="OPEN">{cycle.openedLabel}</DetailItem>
          <DetailItem label="CLOSE & ASSIGN">{cycle.closedLabel}</DetailItem>
          <DetailItem label="REVIEW DEADLINE">{cycle.reviewDeadlineLabel}</DetailItem>
        </div>
      </SectionCard>
      <div className="instructor-cycle-detail-grid">
        <SectionCard title="Submissions in cycle">
          <div className="instructor-cycle-table">
            <div className="instructor-cycle-row instructor-cycle-row-submissions instructor-cycle-head">
              <span>Submission</span>
              <span>Reviews</span>
              <span>Need</span>
            </div>
            {cycle.submissions.map((row) => (
              <div className="instructor-cycle-row instructor-cycle-row-submissions" key={row.label}>
                <strong>{row.label}</strong>
                <span>{row.reviewsDoneLabel}</span>
                <span>{row.reviewsMissingLabel}</span>
              </div>
            ))}
            {cycle.submissions.length === 0 && (
              <div className="instructor-cycle-row instructor-cycle-row-submissions">
                <span>No Submissions in this Cycle yet.</span>
                <span />
                <span />
              </div>
            )}
          </div>
        </SectionCard>
        <SectionCard title="Reviewer obligations">
          <div className="instructor-cycle-table">
            <div className="instructor-cycle-row instructor-cycle-head">
              <span>Reviewer</span>
              <span>Assigned</span>
              <span>Completed</span>
              <span>Obligation</span>
            </div>
            {cycle.reviewers.map((reviewer) => (
              <div className="instructor-cycle-row" key={reviewer.id}>
                <strong>{reviewer.name}</strong>
                <span>{reviewer.assignedLabel}</span>
                <span>{reviewer.completedLabel}</span>
                {reviewer.waived ? (
                  <span className="instructor-cycle-waived">Waived</span>
                ) : (
                  <button
                    type="button"
                    className="instructor-cycle-waive-link"
                    onClick={() => navigate(`/instructor/peer-cycles/${cycle.id}/waive/${reviewer.id}`)}
                  >
                    Waive
                  </button>
                )}
              </div>
            ))}
            {cycle.reviewers.length === 0 && (
              <div className="instructor-cycle-row">
                <span>No Reviewers assigned yet.</span>
                <span />
                <span />
                <span />
              </div>
            )}
          </div>
        </SectionCard>
      </div>
      <WarningPanel title="Interventions">
        Grade missing reviews directly and inspect submissions with score discrepancies.
      </WarningPanel>
    </InstructorPage>
  );
};

export default PeerCycleDetail;
