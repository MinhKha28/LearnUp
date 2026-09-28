import { Input, message } from "antd";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  findPeerCycle,
  findPeerCycleReviewer,
  waivePeerCycleReviewer,
} from "@/components/instructor/instructor.data";
import {
  InstructorButton,
  InstructorPage,
  PageHeader,
  SectionCard,
  WarningPanel,
} from "@/components/instructor/instructor.ui";
import "./peer.cycles.scss";

const PeerCycleWaive = () => {
  const { cycleId, reviewerId } = useParams();
  const navigate = useNavigate();
  const cycle = findPeerCycle(cycleId);
  const reviewer = cycle ? findPeerCycleReviewer(cycle, reviewerId) : undefined;
  const [reason, setReason] = useState("");

  if (!cycle || !reviewer) {
    return (
      <InstructorPage className="instructor-peer-cycles">
        <PageHeader
          eyebrow="CYCLE / OBLIGATION"
          title="Reviewer not found"
          subtitle="This Reviewer obligation may have been removed."
          back
        />
        <InstructorButton onClick={() => navigate("/instructor/peer-cycles")}>
          Back to Peer Cycles
        </InstructorButton>
      </InstructorPage>
    );
  }

  const handleConfirm = () => {
    waivePeerCycleReviewer(cycle, reviewer.id);
    message.success("Peer Review obligation waived.");
    navigate(`/instructor/peer-cycles/${cycle.id}`);
  };

  return (
    <InstructorPage className="instructor-peer-cycles">
      <PageHeader
        eyebrow="CYCLE / OBLIGATION"
        title="Waive Peer Review Obligation"
        subtitle="Use only when no later cycle can provide a replacement review."
        back
      />
      <SectionCard className="instructor-waive-card">
        <h2>Learner: {reviewer.name}</h2>
        <p>Assignment: {cycle.assignmentTitle}</p>
        <WarningPanel title="Eligibility rule">
          Missed reviews normally carry to the next eligible cycle.
        </WarningPanel>
        <div className="instructor-waive-field">
          <label>Reason for waiver</label>
          <Input.TextArea
            rows={5}
            placeholder="Explain why no suitable future cycle remains..."
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        <div className="instructor-waive-actions">
          <InstructorButton type="primary" onClick={handleConfirm}>
            Confirm waiver
          </InstructorButton>
        </div>
      </SectionCard>
    </InstructorPage>
  );
};

export default PeerCycleWaive;
